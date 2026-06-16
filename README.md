# scrapy-spider-gen

A [Pi](https://github.com/badlogic/pi-mono) extension that generates Scrapy spiders from web pages. Downloads HTML, strips the noise, and feeds the cleaned DOM to the LLM for automatic selector extraction and spider generation.

## The problem

A typical e-commerce page weighs **500KB–2MB** of raw HTML. Most of it is noise for an LLM trying to identify CSS/XPath selectors on product content:

- `<style>` / `<link>` blocks
- `<script>` tags (analytics, tracking, hydration)
- Dozens of `data-*` attributes
- Inline SVG icons
- HTML comments

## How it works

```
Raw HTML (2MB)
      │
      ▼
[scrapy-spider-gen extension]
  ├── Strip <script>, <style>, <svg>, <noscript>, <iframe>, …
  ├── Filter parasitic attributes (style, onclick, data-tracking…)
  ├── Keep only structural DOM
  └── Optionally extract product zone only (main, article…)
      │
      ▼
Cleaned HTML (20–50KB)
      │
      ▼
[LLM via Pi]  ←  spider template + item fields
      │
      ▼
Completed Scrapy spider
```

## Install

```bash
pi install npm:scrapy-spider-gen
```

Or from source:

```bash
git clone <this-repo>
cd pi-vapalape
npm install
pi install ./
```

## Usage

### Command: `/spider-create`

```
/spider-create url=<url_or_path> [template=<path>] [level=light|normal|aggressive] [prompt=<text_or_path>]
```

| Parameter | Description | Default |
|-----------|-------------|---------|
| `url` | HTTPS URL or local file path to the HTML page | *required* |
| `template` | Path to a Scrapy spider template file | — |
| `level` | Cleaning intensity | `normal` |
| `prompt` | Custom prompt: inline text (single word) or path to a prompt file | — |

**Examples:**

```
/spider-create url=https://shop.example.com/product/42
/spider-create url=https://shop.example.com/product/42 template=./spider.py level=aggressive
/spider-create url=./pages/product.html level=light
/spider-create url=https://shop.example.com/product/42 prompt=./my_instructions.txt
```

### Tool: `spider_clean`

LLM-callable tool that fetches, cleans, and returns structural HTML for Scrapy selector analysis. The LLM can also call it directly when generating or completing a spider.

## Clean levels

| Level | What it does |
|-------|-------------|
| **light** | Removes `<script>`, `<style>`, `<svg>`, `<noscript>`, `<iframe>`, `<canvas>`, `<video>`, `<audio>`, `<link>`, `<meta>`, `<template>` |
| **normal** | *light* + filters parasitic attributes (`style`, `onclick`, `data-tracking`…), keeps only structural attributes (`id`, `class`, `href`, `src`, `alt`, `data-product-*`, Schema.org…) |
| **aggressive** | *normal* + extracts only the product zone using heuristics (Schema.org markers, `.product-detail`, `main`, `article`, `[role='main']`…) |

## Safety

Cleaned HTML is capped at **400KB** to stay within LLM context limits. If the output exceeds this threshold, it is truncated with a warning.

## Architecture

```
src/
├── index.ts          — Entry point: /spider-create command + spider_clean tool
├── arg-parser.ts     — Parses /spider-create command arguments
├── fetcher.ts        — Downloads HTML from URL or reads local file
├── html-cleaner.ts   — Cleans HTML: removes noise, filters attributes, extracts product zone
└── *.test.ts         — Co-located tests (vitest)
```

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
