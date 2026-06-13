# Worldview

[![CI](https://github.com/dhanjit/worldview/actions/workflows/ci.yml/badge.svg)](https://github.com/dhanjit/worldview/actions/workflows/ci.yml)

> Where public experts stand on the big questions — with receipts.

Worldview maps named experts' public positions onto comparable axes and renders them as an **opinion wheel**: each sector is one question, center-to-rim traces that question's axis, and every dot is one expert's stance. Click in for the per-topic spectrum, the receipt behind each position, and side-by-side expert comparison.

The product is **centered on Indian politics**: the default wheel covers India's national debates — China posture, US alignment, economic model, institutions, and the 2035 trajectory — argued by nine of India's best-known public intellectuals. A second wheel carries the US/Western debates; each perspective is its own wheel with its own questions and roster, never a filter.

**Status: pre-alpha.** All positions are hand-scored, clearly-labeled placeholders. The extraction pipeline (Wikipedia → LLM via [OpenRouter](https://openrouter.ai) → claim records with verbatim quotes, source links and dates) exists but its output has not yet replaced the seed data. The model is a one-variable swap (`EXTRACT_MODEL`) — the pipeline is deliberately provider-agnostic. Live at [worldview.dhanjit.me](https://worldview.dhanjit.me).

## Quick start

```sh
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript, strict mode |
| `infisical run -- npm run extract -- "John Mearsheimer"` | Recommended. Infisical injects `OPENROUTER_API_KEY`; extracts claim records to `data/extracted/` (model via `EXTRACT_MODEL`, default `anthropic/claude-opus-4.8`) |
| `npm run extract -- "John Mearsheimer"` | Same, when the key is supplied another way (see resolution order below) |
| `npm run secret:set` / `secret:clear` | Offline fallback: store/remove `OPENROUTER_API_KEY` encrypted at rest (Windows DPAPI, CurrentUser) — no plaintext file |

**Secret resolution order:** environment variable (what `infisical run` injects) → `.env` → Windows DPAPI vault. Secrets live in Infisical; the local vault and `.env` are fallbacks for offline runs.

## How it works

The atom is the **claim record** — everything on screen is a query over claims:

```json
{
  "expertId": "mear",
  "topicId": "ukr",
  "type": "should",
  "frame": "us-western",
  "score": 8,
  "summary": "Argues NATO expansion provoked the war; urges a settlement.",
  "quote": null,
  "sourceUrl": "https://en.wikipedia.org/wiki/John_Mearsheimer",
  "saidOn": null,
  "aboutWhen": null,
  "retrievedOn": "2026-06-11",
  "confidence": "placeholder",
  "status": "illustrative"
}
```

Claims are typed `should` (policy positions), `is` (assessments of the present), or `will` (predictions), and carry a `frame` — whose debate the axis belongs to. The current wheel is explicitly the **US/Western frame**; a perspective is its own wheel (own questions, own roster, own pole wording), never a silent filter. Full data model, axis rubrics, provenance rules and roadmap: [docs/DESIGN.md](docs/DESIGN.md).

```
src/data/*.json      topics, experts, schools, claims (the seed store)
src/lib/             types + data joins
src/components/      Wheel, TopicPanel, ComparePanel
scripts/extract.mjs  Wikipedia → Claude → claim records
docs/DESIGN.md       methodology, rubrics, roadmap
```

## Deploy (Cloudflare Workers, static assets)

Live at [worldview.dhanjit.me](https://worldview.dhanjit.me). The site ships as a Worker with static assets ([wrangler.toml](wrangler.toml)); the custom domain and its DNS record are managed by the deploy itself.

```sh
npm run build
npx wrangler deploy
```

Pushes to `main` build and deploy automatically via [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) (repo connected in the Cloudflare dashboard); non-production branches get preview URLs. Manual deploys need `wrangler login` under the Cloudflare account that owns the `dhanjit.me` zone. GitHub Actions CI gates quality (typecheck + build) but does not deploy.

## Data licensing

Source text comes from Wikipedia under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — attributed in the UI, with quotes kept verbatim and linked to the page (and to the underlying primary citation when available). Code license: TBD.
