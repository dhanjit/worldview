# CLAUDE.md

## What this is

Worldview — a public site mapping named geopolitics experts' positions onto comparable axes, rendered as an opinion wheel with per-topic spectra, receipts, and side-by-side comparison. Pre-alpha; all seed data is hand-scored and labeled `illustrative`. Target host: worldview.dhanjit.me (Cloudflare Pages, auto-deploy from `main`).

## Commands

- `npm run dev` / `npm run build` / `npm run preview`
- `npm run typecheck` — strict TS, no emit
- `npm run extract -- "<Wikipedia Page Title>"` — Wikipedia fetch always; Claude extraction only when `ANTHROPIC_API_KEY` is set; writes to `data/extracted/` (gitignored, review before promoting into `src/data/claims.json`)

CI (`.github/workflows/ci.yml`) runs typecheck + build on every push and PR. Keep both green.

## Architecture

- The atom is the claim record (`Claim` in [src/lib/types.ts](src/lib/types.ts)): expert × topic × type (`should`/`is`/`will`) × frame, score 0–100 along the topic's axis, summary, verbatim quote, sourceUrl, saidOn vs aboutWhen (two distinct time dimensions), confidence, status (`illustrative` → `extracted` → `reviewed`).
- Every view is a query over claims. The wheel is should-claims grouped by topic (plus one will-type axis, `ord`). Planned views — state-of-the-world (`is`), per-expert futures (`will`), ask-anything composition — must reuse the store, not grow new models.
- Data flow: `src/data/*.json` → joins in [src/lib/data.ts](src/lib/data.ts) → components ([Wheel](src/components/Wheel.tsx), [TopicPanel](src/components/TopicPanel.tsx), [ComparePanel](src/components/ComparePanel.tsx)).
- No UI framework beyond React; hand-rolled CSS in [src/styles.css](src/styles.css) with light/dark via `prefers-color-scheme`. Keep the bundle lean.

## Product rules (non-negotiable)

1. **Receipts.** Never render a stance without source URL and dates. `claim.status` stays visible in the UI until a claim is `reviewed`. A claim without a verbatim quote keeps `confidence` below `high`.
2. **Axes are editorial.** Topic axes are hand-curated with written rubrics in [docs/DESIGN.md](docs/DESIGN.md). Changing an axis's wording means re-scoring every claim on it — never silently reinterpret scores.
3. **A perspective is its own wheel.** Own questions, own roster, own pole wording, tracked by the mandatory `frame` field. Never present one frame's wheel as neutral, and never make frame a silent filter.
4. **Composition, never ventriloquism.** Future composed answers may only assemble real claims, with provenance tiers: direct claim / school-level composition (labeled) / declared gap. Never synthesize what a named person "would" say. Gaps are content.
5. **Licensing.** Wikipedia text is CC BY-SA 4.0: attribute, quote verbatim, prefer linking the underlying primary citation pulled from `<ref>` tags.

## Conventions

- TypeScript strict; `noUnusedLocals`/`noUnusedParameters` are on.
- Short stable ids (`mear`, `ukr`, `us-western`); claim ids `<expert>-<topic>`.
- Seed data lives in `src/data/` and is committed; pipeline output lives in `data/extracted/` and is not.
- Scores are integers 0–100 toward `poleB`; `null` means "no public position found", which is itself signal — don't invent one.

## Roadmap (abridged — details in docs/DESIGN.md)

v1 wheel with real extracted receipts → v1.5 state-of-the-world view (`is` claims, facts-vs-values split) → v2 primary-source ingestion, futures view, accountability ledger → v3 ask-anything composed answers. Deferred: expert "debates".
