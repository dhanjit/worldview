#!/usr/bin/env node
/**
 * Worldview extraction pipeline (v1).
 *
 * Wikipedia "views" sections → LLM via OpenRouter → validated claim records
 * in data/extracted/. Every claim passes through two mechanical guards before
 * staging:
 *   1. Schema enforcement — the request is constrained to the claim JSON
 *      schema (response_format json_schema, routed only to providers that
 *      support it via require_parameters).
 *   2. Verbatim-quote guard — a quote that is not a substring of the fetched
 *      source text is nulled and its confidence downgraded. Quotes are never
 *      trusted on the model's word.
 *
 * Usage:
 *   node scripts/extract.mjs "John Mearsheimer"
 *
 * Reads OPENROUTER_API_KEY from the environment or worldview/.env. Without a
 * key it performs the Wikipedia fetch only, so data plumbing stays testable.
 * Model defaults to anthropic/claude-opus-4.8; override with EXTRACT_MODEL
 * (e.g. deepseek/deepseek-v4-pro, qwen/qwen3.7-max) — the provider seam is
 * this one env var.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch {
  // no .env — environment variables may still be set externally
}

// Key resolution order: explicit env var > .env (above) > Windows DPAPI vault.
// Recommended: `infisical run -- npm run extract -- "Name"` — Infisical injects
// OPENROUTER_API_KEY as an env var, taking the top of this chain. The DPAPI
// vault (scripts/secret.ps1, `npm run secret:set`) is the offline fallback.
if (!process.env.OPENROUTER_API_KEY && process.platform === "win32") {
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass",
     "-File", fileURLToPath(new URL("./secret.ps1", import.meta.url)), "-Get"],
    { encoding: "utf8" },
  );
  const v = r.status === 0 ? r.stdout.trim() : "";
  if (v) process.env.OPENROUTER_API_KEY = v;
}

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const HEADERS = { "User-Agent": "WorldviewBot/0.1 (+https://worldview.dhanjit.me)" };
const SECTION_RE = /(view|position|politic|foreign|opinion|thought|stance|ideolog|career)/i;
const MODEL = process.env.EXTRACT_MODEL || "anthropic/claude-opus-4.8";

async function wiki(params) {
  const url = new URL(WIKI_API);
  for (const [k, v] of Object.entries({ format: "json", formatversion: "2", ...params })) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status} for ${url}`);
  const body = await res.json();
  if (body.error) throw new Error(`Wikipedia API error: ${body.error.info}`);
  return body;
}

async function getViewsSections(title) {
  // redirects:1 follows page redirects (e.g. "C. Raja Mohan" → its canonical title).
  const meta = await wiki({ action: "parse", page: title, prop: "sections", redirects: "1" });
  const canonical = meta.parse.title;
  const sections = meta.parse.sections.filter((s) => SECTION_RE.test(s.line));
  const out = [];
  for (const s of sections) {
    const data = await wiki({ action: "parse", page: canonical, prop: "wikitext", section: s.index });
    out.push({ heading: s.line, level: s.level, wikitext: data.parse.wikitext });
  }
  return { pageTitle: canonical, sections: out };
}

const CLAIMS_SCHEMA = {
  type: "object",
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topicId: { type: "string" },
          type: { type: "string", enum: ["should", "is", "will"] },
          score: { type: ["integer", "null"] },
          summary: { type: "string" },
          quote: { type: ["string", "null"] },
          sourceUrl: { type: "string" },
          saidOn: { type: ["string", "null"] },
          aboutWhen: { type: ["string", "null"] },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: [
          "topicId", "type", "score", "summary", "quote",
          "sourceUrl", "saidOn", "aboutWhen", "confidence",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["claims"],
  additionalProperties: false,
};

function buildPrompt(pageTitle, sections, topics) {
  const axes = topics
    .map(
      (t) =>
        `- ${t.id} (${t.type}, frame ${t.frame}): "${t.question}" — 0 = ${t.poleA}, 100 = ${t.poleB}`,
    )
    .join("\n");
  const text = sections.map((s) => `== ${s.heading} ==\n${s.wikitext}`).join("\n\n");
  return `You are extracting structured claims for Worldview, a site that maps named experts' public positions with receipts.

Expert page: ${pageTitle}

Topic axes (score 0-100 along each axis, or null if the text does not support a score):
${axes}

Rules — these are non-negotiable:
1. Extract ONLY claims supported by the text below. Never infer from the expert's general reputation.
2. "quote" must be VERBATIM from the text (the prose claim, not markup). If no usable quote exists, use null and lower confidence. Quotes are mechanically checked against the source; an invented quote is worse than none.
3. Wikitext <ref> tags near a claim usually contain the primary source. Put that URL in "sourceUrl" when present; otherwise use the Wikipedia page URL.
4. "saidOn" is the date of the underlying statement if the text or its citation reveals it (ISO, may be year-only), else null.
5. "aboutWhen" only for will-type claims: the period the prediction concerns.
6. One claim per topic axis at most. Skip axes the text does not address — silence is data.
7. "summary" is at most 140 characters, neutral voice, hedged attribution ("Argues...", "Has written...").

Wikipedia source text (CC BY-SA 4.0):
${text}`;
}

function normalize(s) {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function validateClaims(raw, sections, topics) {
  const topicById = Object.fromEntries(topics.map((t) => [t.id, t]));
  const sourceText = normalize(sections.map((s) => s.wikitext).join("\n"));
  const issues = [];
  const claims = [];

  for (const c of raw) {
    const topic = topicById[c.topicId];
    if (!topic) {
      issues.push(`dropped claim with unknown topicId "${c.topicId}"`);
      continue;
    }
    if (c.type !== topic.type) {
      issues.push(`dropped ${c.topicId}: type ${c.type} does not match axis type ${topic.type}`);
      continue;
    }
    if (c.score != null && (c.score < 0 || c.score > 100)) {
      issues.push(`${c.topicId}: score ${c.score} out of range, set to null`);
      c.score = null;
    }
    if (c.quote != null && !sourceText.includes(normalize(c.quote))) {
      issues.push(`${c.topicId}: quote failed verbatim check — nulled, confidence downgraded`);
      c.quote = null;
      c.confidence = "low";
    }
    claims.push(c);
  }
  return { claims, issues };
}

async function extractWithLLM(prompt) {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": "https://worldview.dhanjit.me",
      "X-Title": "Worldview",
    },
  });
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 16000,
    messages: [{ role: "user", content: prompt }],
    response_format: {
      type: "json_schema",
      json_schema: { name: "claims", strict: true, schema: CLAIMS_SCHEMA },
    },
    // OpenRouter extension: only route to providers that honor response_format
    provider: { require_parameters: true },
  });
  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Empty completion from model");
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1] : text).claims;
}

async function main() {
  const title = process.argv[2];
  if (!title) {
    console.error('Usage: node scripts/extract.mjs "<Expert Page Title>"');
    process.exit(1);
  }

  console.log(`Fetching views sections for "${title}"...`);
  const { pageTitle, sections } = await getViewsSections(title);
  if (sections.length === 0) {
    console.log("No views-type sections found. The page may keep positions in the lead or under unusual headings.");
    return;
  }
  for (const s of sections) {
    console.log(`  [L${s.level}] ${s.heading} — ${s.wikitext.length.toLocaleString()} chars`);
  }

  if (!process.env.OPENROUTER_API_KEY) {
    console.log("\nOPENROUTER_API_KEY not set — stopping after the Wikipedia fetch.");
    console.log("Store it with `npm run secret:set` (encrypted, recommended) or in worldview/.env.");
    return;
  }

  const allTopics = JSON.parse(
    await readFile(new URL("../src/data/topics.json", import.meta.url), "utf8"),
  );
  const experts = JSON.parse(
    await readFile(new URL("../src/data/experts.json", import.meta.url), "utf8"),
  );
  // An expert may only be scored on axes belonging to a frame they appear on —
  // otherwise the model picks a same-topic axis from the wrong frame (e.g. an
  // India expert scored on the US-Western China axis), producing orphan claims
  // that never render on that expert's wheel.
  // Match on display name or the expert's actual Wikipedia page title — bylines
  // ("C. Raja Mohan") and page titles ("Raja Mohan") often differ.
  const pageOf = (e) =>
    decodeURIComponent((e.wikipedia.split("/wiki/")[1] || "")).replace(/_/g, " ");
  const expert = experts.find(
    (e) => e.name === title || e.name === pageTitle || pageOf(e) === title || pageOf(e) === pageTitle,
  );
  const topics = expert
    ? allTopics.filter((t) => expert.wheels.includes(t.frame))
    : allTopics;
  if (!expert) {
    console.warn(`  ⚠ "${pageTitle}" not in experts.json — scoring against all frames; add them and re-run for frame-correct axes.`);
  } else {
    console.log(`  frames: ${expert.wheels.join(", ")} → ${topics.length} axes`);
  }

  console.log(`\nExtracting claims with ${MODEL} via OpenRouter (structured outputs)...`);
  const raw = await extractWithLLM(buildPrompt(pageTitle, sections, topics));
  const { claims, issues } = validateClaims(raw, sections, topics);
  for (const i of issues) console.warn(`  ⚠ ${i}`);

  const slug = pageTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const outDir = new URL("../data/extracted/", import.meta.url);
  await mkdir(outDir, { recursive: true });
  const outPath = new URL(`${slug}.json`, outDir);
  await writeFile(
    outPath,
    JSON.stringify(
      claims.map((c) => ({
        ...c,
        expertPage: pageTitle,
        retrievedOn: new Date().toISOString().slice(0, 10),
        status: "extracted",
      })),
      null,
      2,
    ),
  );
  console.log(
    `Wrote ${claims.length} claims to data/extracted/${path.basename(fileURLToPath(outPath))} (review before promoting to src/data/claims.json).`,
  );
}

main().catch((err) => {
  console.error(err.message ?? err);
  // Set exitCode rather than process.exit() — an abrupt exit while a fetch
  // socket is still closing trips a libuv assertion on Windows (exit 0xC0000409).
  process.exitCode = 1;
});
