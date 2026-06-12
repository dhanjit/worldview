# Worldview — design and methodology

## Concept

A public, receipts-backed map of elite political opinion — politics in general, not just geopolitics: governance, economy, institutions, and strategic affairs all live in the same catalog as axes with frames. Named experts' public positions are extracted into structured **claim records** and rendered as comparable visualizations — starting with an opinion wheel. The differentiators, in order: receipts on every stance, comparability across experts, perspective-explicit framing, and (later) longitudinal accountability for predictions.

## The claim record

The atom of the product. Every view is a query over claims; no feature may grow its own data model.

| Field | Meaning |
| --- | --- |
| `expertId`, `topicId` | Joins to the roster and the axis catalog |
| `type` | `should` (policy position) · `is` (assessment of the present) · `will` (prediction) |
| `frame` | Whose debate the axis belongs to (e.g. `us-western`). Mandatory. |
| `score` | 0–100 along the topic's axis (poleA = 0, poleB = 100), `null` if unscorable |
| `summary` | ≤140 chars, neutral voice |
| `quote` | Verbatim supporting quote. `null` only while `status` is `illustrative` |
| `sourceUrl` | Primary citation when available (pulled from Wikipedia `<ref>` tags), else the page |
| `saidOn` / `aboutWhen` | Two distinct time dimensions: when it was said vs what period it concerns (`will` only) |
| `retrievedOn`, `confidence`, `status` | Pipeline provenance; `status`: `illustrative` → `extracted` → `reviewed` |

Position drift over time is data, not noise: when an expert's position changes, add a new claim with a newer `saidOn` — don't overwrite. **The latest claim is the only one views may render as current** — enforced in code by `claimFor()` (newest by `saidOn`, falling back to `retrievedOn`); `claimHistoryFor()` returns the full trail, newest first, and feeds the future drift/timeline view.

## Claim types and views

| View | Query | Ships |
| --- | --- | --- |
| Opinion wheel (this repo) | `should` claims, grouped by topic, one frame | v1 |
| Topic spectrum + receipts | one topic, all experts | v1 |
| Compare two experts | claim pairs + agreement verdicts | v1 |
| State of the world | `is` claims, expert consensus + facts-vs-values split | v1.5 |
| Futures per expert | `will` claims, filter expert, group by `aboutWhen` | v2 |
| Accountability ledger | `will` claims whose `aboutWhen` has arrived | v2+ |
| Ask anything (composed answers) | NL question → decompose → retrieve → compose | v3 |
| Expert "debates" | — | deferred indefinitely |

## Perspectives

A perspective is **its own wheel** — own questions, own roster, own pole wording — never a filter on someone else's wheel. The current wheel is explicitly the US/Western policy frame and is labeled as such. Descriptive/predictive questions ("is the US-led order ending?") are frame-free and can live on a shared global wheel; prescriptive questions ("what should X do?") are inherently framed. UI rule: the active frame is always visible and switchable; locale may soft-default it, never silently.

## Provenance tiers (for composed answers, v3)

1. **Direct claim** — the expert addressed this; quote and source attached.
2. **School-level composition** — labeled inference from a school's actual claims ("realists who have addressed this argue…"). Never attributed to an individual.
3. **Declared gap** — "no indexed expert has addressed this." Gaps are content: they show where elite attention isn't.

Person-level synthesis of unsaid views is forbidden, everywhere, including marketing copy.

## India frame (default)

The product is centered on Indian politics: the `india` wheel is the default landing frame, covering the **national blend** — governance, economic model, institutions, and strategic posture (China, US). These are the debates India's public intellectuals actually conduct in print.

**Launch-scope decision (2026-06-12):** the most contested culture-war axes (secularism/Hindutva framing, reservation, UCC) are deliberately **deferred until extraction is real** — publishing hand-scored placeholder positions for living Indian commentators on those axes carries misrepresentation risk that receipts are specifically designed to remove. They join the catalog when every claim carries a verbatim quote, source and date. India's defamation climate (criminal as well as civil) raises the stakes; hedged summaries ("has argued…") and visible `status` labels are mandatory in the meantime.

Roster (launch): Pratap Bhanu Mehta, Ramachandra Guha (liberal constitutionalist); Yogendra Yadav (left-progressive); Swaminathan Aiyar, Surjit Bhalla (economic liberal); S. Gurumurthy (nationalist right); C. Raja Mohan, Shivshankar Menon, Brahma Chellaney (strategic realist). The Institutions axis intentionally has no claims for the strategic trio — no sustained public position found, and silence is data.

## Axis rubric example — `ukr` (Ukraine endgame)

Score the expert's most recent clearly stated position. Anchors:

- **0** — Immediate ceasefire on current lines; neutrality for Ukraine; sanctions relief on the table.
- **25** — Push for negotiations soon; territorial concessions acceptable in exchange for credible security guarantees.
- **50** — Conditional support: keep arming Ukraine while actively seeking an off-ramp; endgame deliberately ambiguous.
- **75** — Sustain or increase support until Ukraine can negotiate from clear strength; concessions are Kyiv's call alone.
- **100** — Support until full territorial restoration including Crimea; no negotiations before withdrawal; NATO membership on the table.

Every axis added to the catalog needs a rubric of this form before any claim is scored on it. Changing rubric wording invalidates existing scores on that axis.

## Roster criteria

- Notable enough for a substantive Wikipedia page (cold-start proxy; revisit later).
- A public corpus of positions (books, op-eds, interviews) — not just an affiliation.
- Mix of schools per wheel; the panel's composition is published.
- Former officials are eligible; sitting policymakers are excluded for now (their statements are constrained speech, not analysis).

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Misrepresenting a living person | Receipts on every dot; verbatim quotes; visible `status`/`confidence`; conservative `null` over guessed scores |
| Axis framing bias | Hand-curated axes with published rubrics; perspective-explicit wheels; this document is public |
| Staleness (Wikipedia lags news) | Honest `retrievedOn`; v2 adds primary feeds; drift becomes a feature (timeline view) |
| Roster selection bias | Published criteria + panel composition; per-wheel rosters |
| English-Wikipedia Anglosphere skew | Acknowledged; non-English Wikipedias planned for non-Western rosters |

## Data sources

- **Wikipedia (cold start).** Pundit pages keep curated "Views" sections where claims arrive pre-cited to primary sources — the receipts come free. CC BY-SA 4.0: attribute, quote verbatim, link back.
- **Wikidata** (roster expansion via occupation/notability queries) — later.
- **Primary feeds** (op-eds, podcast transcripts, books) — v2; required for fresh `will` claims and the accountability ledger.
