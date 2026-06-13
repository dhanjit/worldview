#!/usr/bin/env node
/**
 * Worldview extraction pipeline (v2) — source-agnostic.
 *
 * One extraction core (prompt → LLM via OpenRouter → schema enforcement →
 * verbatim-quote guard → frame/type validation) fed by pluggable sources:
 *   --source wikipedia   an expert's Wikipedia "views" sections (CC BY-SA)
 *   --source oped        an expert's op-ed columns (scripts/data/sources.json)
 *
 * Usage:
 *   infisical run -- npm run extract -- "C. Raja Mohan"
 *   infisical run -- npm run extract -- --source oped "C. Raja Mohan"
 *
 * Key resolution: env var (what `infisical run` injects) → .env → DPAPI vault.
 * Model: EXTRACT_MODEL (default anthropic/claude-opus-4.8). Provider-agnostic
 * by design — swapping models is a config change, never a code change.
 *
 * Op-ed bodies are held in memory only; just quote + summary + url + date are
 * written. Output is staged to data/extracted/ (gitignored) for human review
 * before promotion into src/data/claims.json.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { fetchOpEd, sleep } from "./sources/oped.mjs";

try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch {
  // no .env — environment variables may still be set externally
}

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
const WIKI_UA = "WorldviewBot/0.1 (+https://worldview.dhanjit.me)";
const SECTION_RE = /(view|position|politic|foreign|opinion|thought|stance|ideolog|career)/i;
const MODEL = process.env.EXTRACT_MODEL || "anthropic/claude-opus-4.8";

// ---- Wikipedia adapter ----------------------------------------------------

async function wiki(params) {
  const url = new URL(WIKI_API);
  for (const [k, v] of Object.entries({ format: "json", formatversion: "2", ...params })) {
    url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: { "User-Agent": WIKI_UA } });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status} for ${url}`);
  const body = await res.json();
  if (body.error) throw new Error(`Wikipedia API error: ${body.error.info}`);
  return body;
}

async function getViewsSections(title) {
  const meta = await wiki({ action: "parse", page: title, prop: "sections", redirects: "1" });
  const canonical = meta.parse.title;
  const sections = meta.parse.sections.filter((s) => SECTION_RE.test(s.line));
  const out = [];
  for (const s of sections) {
    const data = await wiki({ action: "parse", page: canonical, prop: "wikitext", section: s.index });
    out.push({ title: s.line, text: data.parse.wikitext, level: s.level });
  }
  return { canonical, documents: out };
}

// ---- Extraction core ------------------------------------------------------

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
          sourceUrl: { type: ["string", "null"] },
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

function buildPrompt({ sourceKind, sourceLabel, documents, topics }) {
  const axes = topics
    .map((t) => `- ${t.id} (${t.type}, frame ${t.frame}): "${t.question}" — 0 = ${t.poleA}, 100 = ${t.poleB}`)
    .join("\n");
  const text = documents.map((d) => `== ${d.title} ==\n${d.text}`).join("\n\n");
  const sourceNote =
    sourceKind === "oped"
      ? `The text below is an op-ed/column written BY the expert — every sentence is their own stated view. Use the op-ed's URL as sourceUrl unless the text cites another source for the specific claim.`
      : `The text below is from Wikipedia (CC BY-SA 4.0). Wikitext <ref> tags near a claim usually hold the primary source — put that URL in sourceUrl when present, else leave sourceUrl null.`;
  return `You are extracting structured claims for Worldview, a site that maps named experts' public positions with receipts.

Expert / source: ${sourceLabel}

Topic axes (score 0-100 along each axis, or null if the text does not support a score):
${axes}

${sourceNote}

Rules — these are non-negotiable:
1. Extract ONLY claims supported by the text below. Never infer from the expert's general reputation.
2. "quote" must be VERBATIM from the text (the prose claim, not markup). If no usable quote exists, use null and lower confidence. Quotes are mechanically checked against the source; an invented quote is worse than none.
3. "saidOn" is the ISO date of the statement if the text or its citation reveals it (may be year-only), else null.
4. "aboutWhen" only for will-type claims: the period the prediction concerns.
5. One claim per topic axis at most. Skip axes the text does not address — silence is data.
6. "summary" is at most 140 characters, neutral voice, hedged attribution ("Argues...", "Has written...").

Source text:
${text}`;
}

function normalize(s) {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function validateClaims(raw, topics, sourceText, { defaultSourceUrl, defaultDate }) {
  const topicById = Object.fromEntries(topics.map((t) => [t.id, t]));
  const haystack = normalize(sourceText);
  const issues = [];
  const claims = [];

  for (const c of raw) {
    const topic = topicById[c.topicId];
    if (!topic) {
      issues.push(`dropped claim with unknown/out-of-frame topicId "${c.topicId}"`);
      continue;
    }
    if (c.type !== topic.type) {
      issues.push(`dropped ${c.topicId}: type ${c.type} != axis type ${topic.type}`);
      continue;
    }
    if (c.score != null && (c.score < 0 || c.score > 100)) {
      issues.push(`${c.topicId}: score ${c.score} out of range, set to null`);
      c.score = null;
    }
    if (c.quote != null && !haystack.includes(normalize(c.quote))) {
      issues.push(`${c.topicId}: quote failed verbatim check — nulled, confidence downgraded`);
      c.quote = null;
      c.confidence = "low";
    }
    if (!c.sourceUrl) c.sourceUrl = defaultSourceUrl;
    if (!c.saidOn && defaultDate) c.saidOn = defaultDate;
    claims.push(c);
  }
  return { claims, issues };
}

async function extractWithLLM(prompt) {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: { "HTTP-Referer": "https://worldview.dhanjit.me", "X-Title": "Worldview" },
  });
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 16000,
    messages: [{ role: "user", content: prompt }],
    response_format: {
      type: "json_schema",
      json_schema: { name: "claims", strict: true, schema: CLAIMS_SCHEMA },
    },
    provider: { require_parameters: true },
  });
  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Empty completion from model");
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1] : text).claims;
}

async function runExtraction(opts) {
  const raw = await extractWithLLM(buildPrompt(opts));
  const sourceText = opts.documents.map((d) => d.text).join("\n");
  const { claims, issues } = validateClaims(raw, opts.topics, sourceText, opts);
  for (const i of issues) console.warn(`  ⚠ ${i}`);
  return claims;
}

// ---- Data / expert resolution ---------------------------------------------

async function readJson(rel) {
  return JSON.parse(await readFile(new URL(rel, import.meta.url), "utf8"));
}

const pageOf = (e) =>
  decodeURIComponent((e.wikipedia.split("/wiki/")[1] || "")).replace(/_/g, " ");

function resolveExpert(experts, arg) {
  return experts.find(
    (e) => e.id === arg || e.name === arg || pageOf(e) === arg,
  );
}

function topicsForExpert(allTopics, expert) {
  return expert ? allTopics.filter((t) => expert.wheels.includes(t.frame)) : allTopics;
}

// ---- Main -----------------------------------------------------------------

function parseArgs(argv) {
  let source = "wikipedia";
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--source") source = argv[++i];
    else rest.push(argv[i]);
  }
  return { source, who: rest.join(" ").trim() };
}

async function writeClaims(slug, source, claims, expertLabel) {
  const outDir = new URL("../data/extracted/", import.meta.url);
  await mkdir(outDir, { recursive: true });
  const outPath = new URL(`${slug}.${source}.json`, outDir);
  const stamped = claims.map((c) => ({
    ...c,
    expert: expertLabel,
    retrievedOn: new Date().toISOString().slice(0, 10),
    status: "extracted",
  }));
  await writeFile(outPath, JSON.stringify(stamped, null, 2));
  console.log(
    `Wrote ${claims.length} claims to data/extracted/${path.basename(fileURLToPath(outPath))} (review before promoting to src/data/claims.json).`,
  );
}

async function main() {
  const { source, who } = parseArgs(process.argv.slice(2));
  if (!who) {
    console.error('Usage: node scripts/extract.mjs [--source wikipedia|oped] "<Expert name / id / page title>"');
    process.exit(1);
  }
  if (!["wikipedia", "oped"].includes(source)) {
    console.error(`Unknown --source "${source}" (use wikipedia or oped)`);
    process.exit(1);
  }

  const allTopics = await readJson("../src/data/topics.json");
  const experts = await readJson("../src/data/experts.json");
  const expert = resolveExpert(experts, who);
  const topics = topicsForExpert(allTopics, expert);
  const expertLabel = expert?.name ?? who;
  const slug = (expert?.id ?? who.toLowerCase().replace(/[^a-z0-9]+/g, "-"));

  if (expert) console.log(`Expert: ${expert.name} · frames ${expert.wheels.join(", ")} → ${topics.length} axes`);
  else console.warn(`⚠ "${who}" not in experts.json — scoring against all frames.`);

  const hasKey = !!process.env.OPENROUTER_API_KEY;

  if (source === "wikipedia") {
    const page = expert ? pageOf(expert) : who;
    console.log(`\nFetching Wikipedia views sections for "${page}"...`);
    const { canonical, documents } = await getViewsSections(page);
    if (documents.length === 0) {
      console.log("No views-type sections found.");
      return;
    }
    for (const d of documents) console.log(`  [L${d.level}] ${d.title} — ${d.text.length.toLocaleString()} chars`);
    if (!hasKey) return stopNoKey();
    console.log(`\nExtracting with ${MODEL} via OpenRouter...`);
    const claims = await runExtraction({
      sourceKind: "wikipedia",
      sourceLabel: `${expertLabel} (Wikipedia: ${canonical})`,
      documents,
      topics,
      defaultSourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(canonical.replace(/ /g, "_"))}`,
      defaultDate: null,
    });
    await writeClaims(slug, source, claims, expertLabel);
    return;
  }

  // source === "oped"
  const sources = await readJson("./data/sources.json");
  const urls = expert ? sources[expert.id] ?? [] : [];
  if (urls.length === 0) {
    console.log(`No op-ed URLs for "${expertLabel}" in scripts/data/sources.json — add some and re-run.`);
    return;
  }
  if (!hasKey) return stopNoKey();

  const all = [];
  for (const [i, url] of urls.entries()) {
    console.log(`\n[${i + 1}/${urls.length}] ${url}`);
    const doc = await fetchOpEd(url);
    if (!doc || doc.text.length < 200) continue;
    console.log(`  "${doc.title}" — ${doc.text.length.toLocaleString()} chars · date ${doc.date ?? "unknown"}`);
    console.log(`  Extracting with ${MODEL}...`);
    const claims = await runExtraction({
      sourceKind: "oped",
      sourceLabel: `${expertLabel} — op-ed "${doc.title}"`,
      documents: [{ title: doc.title, text: doc.text }],
      topics,
      defaultSourceUrl: doc.url,
      defaultDate: doc.date,
    });
    all.push(...claims);
    if (i < urls.length - 1) await sleep(2000); // politeness between hosts
  }
  await writeClaims(slug, source, all, expertLabel);
}

function stopNoKey() {
  console.log("\nOPENROUTER_API_KEY not set — stopping after fetch.");
  console.log("Run via `infisical run -- npm run extract -- ...`, or `npm run secret:set`, or set it in .env.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  // exitCode (not process.exit) so a closing fetch socket doesn't trip a
  // libuv assertion on Windows (exit 0xC0000409).
  process.exitCode = 1;
});
