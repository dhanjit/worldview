#!/usr/bin/env node
/**
 * Worldview extraction pipeline (v0).
 *
 * Pulls an expert's "views"-type sections from English Wikipedia, then (if
 * ANTHROPIC_API_KEY is set) asks Claude to extract structured claim records.
 *
 * Usage:
 *   node scripts/extract.mjs "John Mearsheimer"
 *   ANTHROPIC_API_KEY=... node scripts/extract.mjs "John Mearsheimer"
 *
 * Without a key it performs the Wikipedia fetch only and prints what it found,
 * so the data plumbing can be tested independently of the LLM step.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const HEADERS = { "User-Agent": "WorldviewBot/0.1 (+https://worldview.dhanjit.me)" };
const SECTION_RE = /(view|position|politic|foreign|opinion|thought|stance|ideolog|career)/i;

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
    const data = await wiki({
      action: "parse",
      page: title,
      prop: "wikitext",
      section: s.index,
    });
    out.push({ heading: s.line, level: s.level, wikitext: data.parse.wikitext });
  }
  return { pageTitle: meta.parse.title, sections: out };
}

function buildPrompt(pageTitle, sections, topics) {
  const axes = topics
    .map(
      (t) =>
        `- ${t.id} (${t.type}, frame ${t.frame}): "${t.question}" — 0 = ${t.poleA}, 100 = ${t.poleB}`,
    )
    .join("\n");
  const text = sections
    .map((s) => `== ${s.heading} ==\n${s.wikitext}`)
    .join("\n\n");
  return `You are extracting structured claims for Worldview, a site that maps named experts' public positions with receipts.

Expert page: ${pageTitle}

Topic axes (score 0-100 along each axis, or null if the text does not support a score):
${axes}

Rules — these are non-negotiable:
1. Extract ONLY claims supported by the text below. Never infer from the expert's general reputation.
2. "quote" must be VERBATIM from the text (the prose claim, not markup). If no usable quote exists for a claim, return null and lower confidence.
3. Wikitext <ref> tags near a claim usually contain the primary source. Put that URL in "sourceUrl" when present; otherwise use the Wikipedia page URL.
4. "saidOn" is the date of the underlying statement if the text or its citation reveals it (ISO, may be year-only), else null.
5. "aboutWhen" only for will-type claims: the period the prediction concerns.
6. One claim per topic axis at most. Skip axes the text does not address — silence is data.

Return a JSON array of objects:
{ "topicId": string, "type": "should"|"is"|"will", "score": number|null, "summary": string (<= 140 chars, neutral voice), "quote": string|null, "sourceUrl": string, "saidOn": string|null, "aboutWhen": string|null, "confidence": "low"|"medium"|"high" }

Wikipedia source text (CC BY-SA 4.0):
${text}`;
}

async function extractWithClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || "claude-fable-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const text = body.content.map((b) => b.text ?? "").join("");
  const match = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\])/);
  if (!match) throw new Error("No JSON array found in model response");
  return JSON.parse(match[1]);
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
    console.log("Set the key to run claim extraction and write data/extracted/<slug>.json.");
    return;
  }

  const topics = JSON.parse(
    await readFile(new URL("../src/data/topics.json", import.meta.url), "utf8"),
  );
  console.log("\nExtracting claims with Claude...");
  const claims = await extractWithClaude(buildPrompt(pageTitle, sections, topics));

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
  console.log(`Wrote ${claims.length} claims to ${path.basename(outPath.pathname)} (review before promoting to src/data/claims.json).`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
