# llm-citeops

[![npm version](https://img.shields.io/npm/v/llm-citeops.svg)](https://www.npmjs.com/package/llm-citeops)

**llm-citeops** is a Lighthouse-inspired CLI that audits URLs and local files for **AEO** (Answer Engine Optimization) and **GEO** (Generative Engine Optimization). It scores checks, explains failures, and writes **HTML**, **JSON**, or **CSV** reports.

Scores come from **deterministic heuristics** (HTML parsing, JSON-LD, link analysis, readability math, and light NLP with [compromise](https://github.com/spencermountain/compromise)) — **not** from calling an LLM judge.

![HTML audit report — composite, AEO/GEO gauges, and per-check results](assets/report-hero.png)

*Report generated from [`examples/sample.html`](examples/sample.html) in this repo (composite 93, one failing check shown).*

## What we measure

Each row below is one **binary** audit: it **passes (1)** or **fails (0)**. Category scores are a **weighted average** of those outcomes × **100**. The **composite** score blends AEO and GEO (default **50% / 50%**). There is **no percentile** yet (`percentile` is reserved for a future benchmark).

**Reading the numbers**

- **~90+ composite** — Most checks pass; strong answer-engine and trust signals relative to this rubric.
- **~40 composite** — Many checks fail; large gaps versus the checklist (schema, clarity, entities, trust, links, etc.).
- **AEO vs GEO** — AEO leans toward *how directly* the page answers and reads; GEO toward *depth, trust, citations, and freshness*.

**Score bands** (applied to **composite**): **0–49** Poor · **50–74** Needs improvement · **75–89** Good · **90–100** Excellent.

**Formula (default weights)**

```
AEO  = weighted_avg(pass?1:0 for each AEO audit, per-audit weights) × 100
GEO  = weighted_avg(pass?1:0 for each GEO audit, per-audit weights) × 100
Composite = AEO × aeo_weight + GEO × geo_weight   # defaults: 0.5 + 0.5
```

Override per-check weights and category blend in **`.citeops.json`**. See the example in this repo.

### Audit checklist (all 12 checks)

| Check | Cat | What we look for | Default weight |
|-------|-----|------------------|----------------|
| FAQ / HowTo schema present | AEO | `FAQPage` or `HowTo` in `application/ld+json` | ×1.5 |
| Direct answer in first paragraph | AEO | First `<p>` opens with a declarative answer (heuristic) | ×1.5 |
| Q&A density (questions per 500 words) | AEO | Enough `?` in body text vs word count | ×1.5 |
| Readability grade ≤ 10 | AEO | Flesch–Kincaid grade level on body text | ×1.0 |
| Named entity coverage | AEO | People / organizations / places via compromise NER | ×1.0 |
| Author byline + credentials present | AEO | `rel="author"`, `itemprop="author"`, `meta name="author"`, or JSON-LD `author` | ×1.0 |
| Topical depth score (subtopic coverage) | GEO | Top terms reflected in headings (TF-style coverage) | ×1.3 |
| Trust signals (EEAT) — author, org, sources | GEO | Author, publisher/org in schema, external sources, dates, etc. | ×1.3 |
| Content freshness (publish / modified date) | GEO | Recent `article:*`, `<time datetime>`, or JSON-LD dates | ×1.2 |
| External citation / link quality | GEO | ≥2 non-`nofollow` `http(s)` links off-domain | ×1.0 |
| Comparison content present | GEO | Comparison-style headings or `<table>` | ×1.0 |
| Citation likelihood signals | GEO | Bundle of schema, author, FAQ schema, ≥3 external links, heading structure | ×1.3 |

Deeper product notes: [docs/requirements.md](docs/requirements.md).

## Requirements

- **Node.js 18+**

## Try it in one command (no install)

From any project with a Markdown or HTML file:

```bash
npx llm-citeops audit --file ./README.md --output html --output-path ./citeops-report.html
```

Audit a stable public URL (always **quote** URLs that contain `&`):

```bash
npx llm-citeops audit --url "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions" --output html --output-path ./citeops-report.html
```

## Install

- **One-off / CI**: use **`npx llm-citeops`** as above (no global install).
- **Global CLI** (frequent use):

```bash
npm install -g llm-citeops
```

## CLI overview (terminal)

Inputs, report formats, CI exit codes, and quick-start hints:

![llm-citeops overview — terminal capability dashboard](https://raw.githubusercontent.com/rakeshcheekatimala/llm-citeops/main/assets/overview.png)

```bash
llm-citeops overview
# or: llm-citeops info
```

## Quick start

```bash
# Audit a URL (quote URLs that contain &)
llm-citeops audit --url "https://example.com/docs/article" --output html --output-path ./report.html

# Audit a local Markdown or HTML file
llm-citeops audit --file ./content/post.md --output json --output-path ./report.json

# Demo fixture in this repo (rich pass/fail mix)
llm-citeops audit --file ./examples/sample.html --output html --output-path ./citeops-report.html

# Minimal Markdown fixture
llm-citeops audit --file ./examples/sample.md --output html --output-path ./citeops-md-report.html

# Audit every .md / .html in a folder
llm-citeops audit --dir ./content --output csv --output-path ./batch.csv

# Sitemap batch (respects robots.txt unless --ignore-robots)
llm-citeops audit --sitemap "https://example.com/sitemap.xml" --output csv --output-path ./site.csv
```

## Configuration

Optional project or home config: **`.citeops.json`** (see the example in this repo). Override path:

```bash
llm-citeops audit --url "https://example.com" --config ./my-citeops.json
```

## CI mode

Exit code **1** if the composite score is below the threshold:

```bash
llm-citeops audit --url "$DEPLOY_URL" --ci --threshold 70 --output json --output-path ./citeops-report.json
```

| Exit code | Meaning |
|-----------|---------|
| 0 | Success (CI pass if `--ci` and score ≥ threshold) |
| 1 | CI failure (score below threshold) |
| 2 | Crawl / network error |
| 3 | Invalid input or config |

## Releasing (maintainers)

**Automated (recommended)**  
Push an annotated semver tag **`v*`** (e.g. `v1.0.3`) after bumping `version` in `package.json`. The [Release workflow](.github/workflows/release.yml) runs `lint`, `build`, publishes to npm (**`NPM_TOKEN`** secret), and creates a GitHub Release with generated notes.

**Manual**  
Tag, publish with `npm publish --access public`, then create a GitHub Release from that tag with short notes (highlights + any rubric changes).

## How to test (for contributors & pre-publish)

Clone the repo, install dependencies, typecheck, build, then run the CLI against a **local file** first (no network, stable).

```bash
git clone https://github.com/rakeshcheekatimala/llm-citeops.git citeops
cd citeops
npm install
npm run lint          # TypeScript check (tsc --noEmit)
npm run build         # Produces dist/ for the published binary
```

### 1. Smoke test (local Markdown)

```bash
node dist/index.js audit --file ./README.md --output html --output-path ./test-report.html
open ./test-report.html   # macOS; or open in a browser manually
```

You should see a non-empty report with composite / AEO / GEO scores and audit sections.

### 2. Smoke test (JSON for automation)

```bash
node dist/index.js audit --file ./README.md --output json --output-path ./test-report.json
node -e "const r=require('./test-report.json'); console.log(r.scores, r.audits.length)"
```

### 3. Dev mode (no build)

```bash
npm run dev -- audit --file ./README.md --output json
```

### 4. Optional: live URL test

Some sites block simple HTTP clients (403/402/etc.). Prefer **documentation or blog URLs**, and always **quote** URLs that contain `&`:

```bash
node dist/index.js audit --url "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions" --output html --output-path ./mdn-report.html
```

### 5. Before `npm publish`

1. Bump `version` in `package.json` if needed.
2. Run `npm run lint` and `npm run build`.
3. Dry-run the tarball:

   ```bash
   npm pack --dry-run
   ```

   Confirm **`dist/`** and **`templates/`** appear in the packed files.

4. Either push tag **`v<version>`** for the Release workflow, or publish locally (with an npm account and OTP if 2FA is on):

   ```bash
   npm publish --access public
   ```

## Output formats

| Flag | Description |
|------|-------------|
| `--output html` | Single-file HTML report (default) |
| `--output json` | Machine-readable report |
| `--output csv` | Summary row per URL (useful for `--dir` / `--sitemap`) |

## Command reference

```text
llm-citeops overview   (alias: info) — terminal capability dashboard

llm-citeops audit [options]

  --url <url>           Single URL
  --file <path>         Local .md or .html
  --dir <path>          Directory of .md / .html
  --sitemap <url>       Crawl URLs from sitemap.xml

  --output <format>     html | json | csv (default: html)
  --output-path <path>  Write report to this path

  --threshold <n>       CI threshold (default: 70)
  --ci                  Exit 1 if composite < threshold

  --ignore-robots       Ignore robots.txt
  --depth <n>           Crawl depth (default: 1)
  --rate <n>            Requests per second (default: 1)
  --config <path>       Path to .citeops.json

  --probe               Reserved for future LLM probe mode
  --compare <url>       Reserved for future compare mode
```

## License

MIT

## Disclaimer

**llm-citeops** fetches public URLs read-only. Respect each site’s **robots.txt**, **terms of use**, and **rate limits**. You are responsible for compliant use. This tool does not imply endorsement by any third-party site used in examples or tests.
