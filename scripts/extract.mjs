#!/usr/bin/env node
/**
 * Worldview extraction pipeline (v1).
 *
 * Wikipedia "views" sections → Claude (structured outputs) → validated claim
 * records in data/extracted/. Every claim passes through two mechanical guards
 * before staging:
 *   1. Schema enforcement — the API is constrained to the claim JSON schema.
 *   2. Verbatim-quote guard — a quote that is not a substring of the fetched
 *      source text is nulled and its confidence downgraded. Quotes are never
 *      trusted on the model's word.
 *
 * Usage:
 *   node scripts/extract.mjs "John Mearsheimer"
 *
 * Reads ANTHROPIC_API_KEY from the environment or worldview/.env. Without a
 * key it performs the Wikipedia fetch only, so data plumbing stays testable.
 * Model defaults to claude-opus-4-8; override with CLAUDE_MODEL.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch {
  // no .env — environment variables may still be set externally
}

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const HEADERS = { "User-Agent": "WorldviewBot/0.1 (+https://worldview.dhanjit.me)" };
const SECTION_RE = /(view|position|politic|foreign|opinion|thought|stance|ideolog|career)/i;
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";

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
  const meta = await wiki({ action: "parse", page: title, prop: "sections" });
  const sections = meta.parse.sections.filter((s) => SECTION_RE.test(s.line));
  const out = [];
  for (const s of sections) {
    const data = await wiki({ action: "parse", page: title, prop: "wikitext", section: s.index });
    out.push({ heading: s.line, level: s.level, wikitext: data.parse.wikitext });
  }
  return { pageTitle: meta.parse.title, sections: out };
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

async function extractWithClaude(prompt) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: CLAIMS_SCHEMA } },
    messages: [{ role: "user", content: prompt }],
  });
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("No text block in model response");
  return JSON.parse(text).claims;
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

  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("\nANTHROPIC_API_KEY not set — stopping after the Wikipedia fetch.");
    console.log("Set it in worldview/.env to run claim extraction.");
    return;
  }

  const topics = JSON.parse(
    await readFile(new URL("../src/data/topics.json", import.meta.url), "utf8"),
  );
  console.log(`\nExtracting claims with ${MODEL} (structured outputs)...`);
  const raw = await extractWithClaude(buildPrompt(pageTitle, sections, topics));
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
  process.exit(1);
});
