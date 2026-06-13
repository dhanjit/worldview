/**
 * Op-ed source adapter for the Worldview extraction pipeline.
 *
 * Given a column/op-ed URL, returns one readable document
 * `{ text, url, title, date }` for the extraction core to mine.
 *
 * Legal posture: the full article body lives in memory only for the duration
 * of one extraction call and is NEVER persisted. Only a short verbatim quote,
 * a neutral summary, the source URL, and the date reach the claim record —
 * short attributed quotation for comparison/criticism, not republication.
 * We respect robots.txt and rate-limit per host.
 */
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

const UA = "WorldviewBot/0.1 (+https://worldview.dhanjit.me; extraction for expert-stance comparison)";
const robotsCache = new Map();

async function robotsAllowed(url) {
  const u = new URL(url);
  const origin = u.origin;
  if (!robotsCache.has(origin)) {
    robotsCache.set(origin, fetchRobots(origin));
  }
  const rules = await robotsCache.get(origin);
  // rules: array of disallowed path prefixes for User-agent: * (and our UA).
  return !rules.some((prefix) => prefix && u.pathname.startsWith(prefix));
}

async function fetchRobots(origin) {
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const text = await res.text();
    return parseRobots(text);
  } catch {
    return []; // no robots / unreachable → treat as allowed, fetch politely
  }
}

/** Minimal robots parser: collect Disallow prefixes from groups that apply to us. */
function parseRobots(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
  const disallow = [];
  let applies = false;
  for (const line of lines) {
    const m = line.match(/^(user-agent|disallow|allow)\s*:\s*(.*)$/i);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === "user-agent") {
      applies = value === "*" || /worldview/i.test(value);
    } else if (field === "disallow" && applies && value) {
      disallow.push(value);
    }
  }
  return disallow;
}

function extractDate(document) {
  const metaKeys = [
    'meta[property="article:published_time"]',
    'meta[name="article:published_time"]',
    'meta[property="article:modified_time"]',
    'meta[name="date"]',
    'meta[name="pubdate"]',
    'meta[itemprop="datePublished"]',
  ];
  for (const sel of metaKeys) {
    const el = document.querySelector(sel);
    const content = el?.getAttribute("content");
    if (content) {
      const iso = toIsoDate(content);
      if (iso) return iso;
    }
  }
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    const iso = dateFromJsonLd(script.textContent);
    if (iso) return iso;
  }
  const time = document.querySelector("time[datetime]");
  if (time) {
    const iso = toIsoDate(time.getAttribute("datetime"));
    if (iso) return iso;
  }
  return null;
}

function dateFromJsonLd(raw) {
  try {
    const data = JSON.parse(raw);
    const nodes = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
    for (const node of nodes) {
      const d = node?.datePublished || node?.dateCreated;
      if (d) {
        const iso = toIsoDate(d);
        if (iso) return iso;
      }
    }
  } catch {
    /* malformed JSON-LD — ignore */
  }
  return null;
}

function toIsoDate(s) {
  const m = String(s).match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

/**
 * Fetch one op-ed and return a readable document, or null if blocked/unusable.
 * @returns {Promise<{text:string,url:string,title:string,date:string|null}|null>}
 */
export async function fetchOpEd(url) {
  if (!(await robotsAllowed(url))) {
    console.warn(`  ⚠ robots.txt disallows ${url} — skipping`);
    return null;
  }
  let res;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    console.warn(`  ⚠ fetch failed for ${url}: ${e.message}`);
    return null;
  }
  if (!res.ok) {
    console.warn(`  ⚠ HTTP ${res.status} for ${url} — skipping`);
    return null;
  }
  const html = await res.text();
  const { document } = parseHTML(html);
  const date = extractDate(document);
  const docTitle = document.querySelector("title")?.textContent?.trim() ?? url;

  const article = new Readability(document).parse();
  const text = (article?.textContent ?? "").replace(/\s+\n/g, "\n").trim();
  if (text.length < 200) {
    console.warn(`  ⚠ ${url}: extracted only ${text.length} chars (paywall or block?) — keeping, may yield nothing`);
  }
  return { text, url, title: article?.title?.trim() || docTitle, date };
}

/** Politeness delay between requests to the same host. */
export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
