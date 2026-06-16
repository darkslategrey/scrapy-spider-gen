# scrapy-spider-gen-omp

omp.sh (oh-my-pi) variant of [scrapy-spider-gen](../). Generates Scrapy spiders from web pages inside [omp](https://omp.sh/).

This package is a thin variant of `scrapy-spider-gen` that targets the `@oh-my-pi/pi-coding-agent` runtime instead of `@earendil-works/pi-coding-agent`. Functionality, commands, and clean levels are identical.

## Why a separate package

The two Pi ecosystems have diverged:

- **earendil-works / pi-mono** (classic Pi) — `@earendil-works/pi-coding-agent`, exports `StringEnum` from `@earendil-works/pi-ai`.
- **oh-my-pi / omp.sh** (Rust engine) — `@oh-my-pi/pi-coding-agent`, dropped the `StringEnum` helper and now injects `Type` builders + zod through the `ExtensionAPI` itself.

A single package cannot resolve both at the same time, so this variant imports from `@oh-my-pi/*` and uses `pi.typebox.Type` / `pi.zod` for schema authoring.

## Install

With [omp](https://omp.sh/) installed:

```bash
omp install npm:scrapy-spider-gen-omp
```

Or from source:

```bash
git clone <this-repo>
cd pi-vapalape/scrapy-spider-gen-omp
npm install
omp install ./
```

omp discovers the extension through the `pi.extensions` field in `package.json`.

## Usage

Identical to `scrapy-spider-gen`. See the [main README](../README.md) for the full reference.

### Commands

- `/spider-create url=<url_or_path> [template=<path>] [level=light|normal|aggressive] [prompt=<text_or_path>]`
- `/spider-help`

### Tool: `spider_clean`

LLM-callable tool that fetches, cleans, and returns structural HTML.

### Clean levels

`light` · `normal` · `aggressive` — same semantics as the earendil-works variant.

## Architecture

```
scrapy-spider-gen-omp/
├── src/
│   ├── index.ts          — Entry point: /spider-create command + spider_clean tool
│   ├── arg-parser.ts     — Parses /spider-create command arguments
│   ├── fetcher.ts        — Downloads HTML from URL or reads local file
│   ├── html-cleaner.ts   — Cleans HTML: removes noise, filters attributes, extracts product zone
│   └── *.test.ts         — Co-located tests (vitest)
├── package.json          — peerDep @oh-my-pi/pi-coding-agent
├── tsconfig.json
├── vitest.config.ts
└── biome.json
```

Only `src/index.ts` differs from the upstream package: it imports `ExtensionAPI` from `@oh-my-pi/pi-coding-agent` and uses `pi.typebox.Type` / `pi.zod` for schema construction. The other modules (`arg-parser`, `fetcher`, `html-cleaner`) are pure Node and are copied verbatim.

## Development

```bash
npm install
npm test            # vitest run
npm run check       # biome lint + format
npm run format      # auto-fix formatting
npm run build       # tsc
npm run ci          # check + build + test
```

## License

MIT
