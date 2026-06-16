# Agents — scrapy-spider-gen

## Overview

Pi extension that generates Scrapy spiders from web pages. Downloads HTML, cleans it (removes scripts/styles/SVG/parasitic attributes), and feeds the cleaned DOM to the LLM for selector extraction and spider generation.

## Architecture

```
src/
├── index.ts          — Extension entry point: registers `/spider-create` command + `spider_clean` tool
├── arg-parser.ts     — Parses /spider-create command arguments (url, level, template)
├── fetcher.ts        — Downloads HTML from URL or reads local file
├── html-cleaner.ts   — Cleans HTML: removes noise, filters attributes, extracts product zone
└── *.test.ts         — Co-located tests (vitest)
```

## Key concepts

- **Clean levels**: `light` (scripts/styles/SVG only), `normal` (+ attribute filtering), `aggressive` (+ product zone extraction)
- **Security truncation**: Cleaned HTML is capped at 400KB to stay within LLM context limits
- **Product zone heuristics**: In aggressive mode, tries Schema.org markers, then semantic selectors (`.product-detail`, `main`, `article`, etc.)

## Commands

| Command | Usage |
|---------|-------|
| `/spider-create` | `/spider-create url=<url> [template=<path>] [level=light\|normal\|aggressive] [prompt=<text_or_path>]` |

## Tools (LLM-callable)

| Tool | Description |
|------|-------------|
| `spider_clean` | Fetches + cleans HTML, returns structural DOM for Scrapy selector analysis |

## Development

```bash
npm install
npm test          # vitest run
npm run check     # biome lint+format
npm run ci        # check + build + test
```

## Dependencies

- `node-html-parser` — HTML parsing and manipulation
- `@earendil-works/pi-coding-agent` — Pi extension API
- `@earendil-works/pi-ai` — Pi AI utilities (StringEnum)
- `typebox` — Schema definition for tool parameters
