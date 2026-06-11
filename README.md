# Worldview

[![CI](https://github.com/dhanjit/worldview/actions/workflows/ci.yml/badge.svg)](https://github.com/dhanjit/worldview/actions/workflows/ci.yml)

> Where public experts stand on the big questions — with receipts.

Worldview maps named geopolitics experts' public positions onto comparable axes and renders them as an **opinion wheel**: each sector is one question, center-to-rim traces that question's axis, and every dot is one expert's stance. Click in for the per-topic spectrum, the receipt behind each position, and side-by-side expert comparison.

**Status: pre-alpha.** All positions are hand-scored, clearly-labeled placeholders. The extraction pipeline (Wikipedia → Claude → claim records with verbatim quotes, source links and dates) exists but its output has not yet replaced the seed data. Target host: [worldview.dhanjit.me](https://worldview.dhanjit.me).

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
| `npm run extract -- "John Mearsheimer"` | Fetch an expert's Wikipedia views sections; with `ANTHROPIC_API_KEY` set, extract claim records to `data/extracted/` |

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

## Deploy (Cloudflare Pages)

1. Cloudflare dashboard → Workers & Pages → Create → Pages → **Connect to Git** → pick this repo.
2. Build command `npm run build`, output directory `dist` (framework preset: Vite or None).
3. After the first deploy: Custom domains → add `worldview.dhanjit.me` (the zone is already on Cloudflare, so the CNAME is created automatically).

Every push to `main` then deploys automatically. CLI alternative: `npx wrangler pages deploy dist`.

## Data licensing

Source text comes from Wikipedia under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — attributed in the UI, with quotes kept verbatim and linked to the page (and to the underlying primary citation when available). Code license: TBD.
