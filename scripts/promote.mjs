#!/usr/bin/env node
/**
 * Promote staged extracted claims into the live store.
 *
 * Reads data/extracted/*.oped.json (op-ed extractions), maps each to a full
 * Claim record, and writes src/data/claims.json — REPLACING the India-frame
 * claims with these real, quote-backed ones while preserving any other-frame
 * (e.g. us-western) claims already in the store.
 *
 * Real-only policy: only claims with a non-null score are promoted (a score is
 * what renders a dot and lets compare work). All survivors keep their verbatim
 * quote, primary source URL, and date. Multiple claims per expert×axis are kept
 * — they are position drift over time; the app renders the latest and retains
 * the rest as history.
 *
 * Status is set to "extracted" (machine-extracted + quote-verified, not yet
 * hand-reviewed). The UI shows this per claim. Usage:
 *   node scripts/promote.mjs            # promote, write claims.json
 *   node scripts/promote.mjs --dry      # print summary only
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dry = process.argv.includes("--dry");
const extractedDir = new URL("../data/extracted/", import.meta.url);
const claimsPath = new URL("../src/data/claims.json", import.meta.url);

const topics = JSON.parse(await readFile(new URL("../src/data/topics.json", import.meta.url), "utf8"));
const experts = JSON.parse(await readFile(new URL("../src/data/experts.json", import.meta.url), "utf8"));
const topicById = Object.fromEntries(topics.map((t) => [t.id, t]));
const expertIds = new Set(experts.map((e) => e.id));

let files = [];
try {
  files = (await readdir(extractedDir)).filter((f) => f.endsWith(".oped.json"));
} catch {
  console.error("No data/extracted/ directory — run extraction first.");
  process.exit(1);
}

const promoted = [];
const counters = {};
const skipped = [];

for (const file of files.sort()) {
  const expertId = file.replace(/\.oped\.json$/, "");
  if (!expertIds.has(expertId)) {
    skipped.push(`${file}: expert id "${expertId}" not in experts.json`);
    continue;
  }
  const claims = JSON.parse(await readFile(new URL(file, extractedDir), "utf8"));
  for (const c of claims) {
    const topic = topicById[c.topicId];
    if (!topic) { skipped.push(`${expertId}/${c.topicId}: unknown topic`); continue; }
    if (c.score == null) { skipped.push(`${expertId}/${c.topicId}: null score (not renderable) — kept out`); continue; }
    const key = `${expertId}-${c.topicId}`;
    counters[key] = (counters[key] ?? 0) + 1;
    promoted.push({
      id: `${key}-${counters[key]}`,
      expertId,
      topicId: c.topicId,
      type: c.type,
      frame: topic.frame,
      score: c.score,
      summary: c.summary,
      quote: c.quote ?? null,
      sourceUrl: c.sourceUrl,
      saidOn: c.saidOn ?? null,
      aboutWhen: c.aboutWhen ?? null,
      retrievedOn: c.retrievedOn,
      confidence: c.confidence,
      status: "extracted",
    });
  }
}

const promotedFrames = new Set(promoted.map((c) => c.frame));
const existing = JSON.parse(await readFile(claimsPath, "utf8"));
const preserved = existing.filter((c) => !promotedFrames.has(c.frame));
const next = [...promoted, ...preserved];

console.log(`Promoted ${promoted.length} real claims across frames: ${[...promotedFrames].join(", ")}`);
console.log(`Preserved ${preserved.length} claims from other frames (untouched).`);
const quoteBacked = promoted.filter((c) => c.quote).length;
console.log(`  ${quoteBacked}/${promoted.length} promoted claims carry a verbatim quote.`);
if (skipped.length) {
  console.log(`Skipped ${skipped.length}:`);
  for (const s of skipped) console.log(`  - ${s}`);
}

if (dry) {
  console.log("\n--dry: not writing claims.json.");
} else {
  await writeFile(claimsPath, JSON.stringify(next, null, 2) + "\n");
  console.log(`\nWrote ${next.length} claims to ${fileURLToPath(claimsPath)}`);
}
