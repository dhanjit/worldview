# Worldview — roadmap & resume notes

Living checklist for picking the work back up. Status as of 2026-06-13.

## Where things stand

- **Live:** https://worldview.dhanjit.me — India wheel shows **real, quote-backed claims** (status `extracted`); US/Western wheel is still **illustrative**.
- `src/data/claims.json` = 21 real India claims + 45 illustrative us-western (66 total).
- Pipeline is proven end-to-end: research → verify → extract → validate → promote → deploy.
- All secrets via Infisical (`infisical run -- …` injects `OPENROUTER_API_KEY`). Model = `EXTRACT_MODEL` (default `anthropic/claude-opus-4.8`).

## How to run the pipeline (copy-paste)

```sh
# infisical may not be on a pre-existing shell's PATH; full path if needed:
#   %LOCALAPPDATA%\Microsoft\WinGet\Packages\infisical.infisical_*\infisical.exe

# 1. Add verified op-ed URLs to scripts/data/sources.json  (expert id -> [urls])
#    VERIFY each URL fetches >500 chars BEFORE adding (write a temp probe that
#    imports fetchOpEd from scripts/sources/oped.mjs). Never add unverified URLs.

# 2. Extract (op-ed is the real source; wikipedia is cold-start/roster only)
infisical run -- npm run extract -- --source oped "C. Raja Mohan"
infisical run -- npm run extract -- "C. Raja Mohan"          # wikipedia

# 3. Promote staged claims -> live store (dry-run first)
node scripts/promote.mjs --dry
node scripts/promote.mjs

# 4. Ship
npm run typecheck && npm run build && npx wrangler deploy
```

Staging output lands in `data/extracted/<id>.<source>.json` (gitignored). Review before promoting. Promotion replaces a frame's claims, preserves other frames.

## Next gaps (prioritized)

### 1. Fill the 4 unsourced India experts
Each needs verified single-author op-ed URLs in `scripts/data/sources.json`, then extract + promote.
- [ ] **pbm** (Pratap Bhanu Mehta) — Indian Express columns (he's IE editorial consultant). IE fetches well.
- [ ] **bhal** (Surjit Bhalla) — Indian Express columns (IE contributing editor).
- [ ] **guru** (S. Gurumurthy) — New Indian Express / Swarajya columns (his own bylined pieces, not coverage *about* him).
- [ ] **meno** (Shivshankar Menon) — hardest: writes essays/books/interviews, few single-author op-eds. NUS ARI essay was JS-blocked; the LARB piece is an interview (excluded — mixed speakers, violates op-ed prompt). Look for a real signed essay/column, or accept Menon stays thin.

### 2. Improve US-alignment (`usa-in`) coverage
Only Aiyar has a `usa-in` claim. Find columns where India experts address US-India ties (Raja Mohan and Menon write on this often) and add those URLs.

### 3. Optional: human-review pass (`extracted` → `reviewed`)
The 21 live claims are machine-extracted + quote-verified but not hand-reviewed. A pass that bumps good ones to `status: "reviewed"` strengthens credibility. No tool yet — could add a `--status reviewed` flag to promote.mjs or a small review script.

### 4. US/Western frame → real extraction
That wheel is still illustrative. Same process, but add a us-western section to `sources.json` (Foreign Affairs / Atlantic / Project Syndicate — many paywalled, expect teasers). Then promote (it preserves the india real claims).

### 5. New views (data already supports these)
- [ ] **State-of-the-world** — aggregate `is`-claims (institutions axis already is-typed); show expert consensus + the facts-vs-values split.
- [ ] **Drift timeline** — `claimHistoryFor()` already returns dated history per expert×axis (e.g. Chellaney has 4 dated China claims). Render the movement.

## Standing items (need Dhanjit / dashboard)
- [ ] **Workers Builds auto-deploy** — connect the repo in the Cloudflare dashboard (Workers → worldview → Settings → Build). Dashboard-only; no API/CLI. Until then deploys are manual `npx wrangler deploy`.
- [ ] Fill `sources.json` gaps as more accessible columns surface (author RSS / search discovery could automate later).

## Gotchas
- Preview tool: if 5173 is busy, vite jumps to 5174 while the proxy expects another port → blank page. Navigate `window.location` to the real vite port (check `preview_logs`).
- `.ps1` files must be ASCII / UTF-8-with-BOM (PS 5.1 reads BOM-less UTF-8 as cp1252; em-dash → string-terminator parse error).
- Op-ed `sourceUrl` is force-set to the fetched column (don't let the model use a URL cited inside the text).
- Expert match is by id / display name / Wikipedia page title (`pageOf`), so bylines vs page titles both resolve.
