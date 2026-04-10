# llm-citeops

[![npm version](https://img.shields.io/npm/v/llm-citeops.svg)](https://www.npmjs.com/package/llm-citeops)

`llm-citeops` is a Node.js CLI package for auditing web content for AEO and GEO readiness.

It is a read-only content audit tool, not a crawler framework or SEO platform. The package takes a page or a batch of pages, runs a fixed rubric of deterministic checks, computes weighted scores, and generates reports with concrete recommendations.

![HTML audit report — composite, AEO/GEO gauges, and per-check results](assets/report-hero.png)

## What ships today

The current package surface is intentionally small:

- `llm-citeops overview`
- `llm-citeops info`
- `llm-citeops audit`

The main workflow is:

`collect content -> run 12 audits -> compute AEO/GEO/composite scores -> attach recommendations -> write report`

Latest verified local quality snapshot on `2026-04-10`:

- Coverage: `95.06%` lines, `82.33%` branches, `89.07%` functions
- Test suite: `32/32` passing
- Coverage gate: `>= 90%` line coverage

## What the package actually audits

`llm-citeops` currently runs 12 checks split across two categories.

### AEO checks

- FAQ / HowTo schema present
- direct answer in the first paragraph
- Q&A density
- readability grade `<= 10`
- named entity richness
- author byline presence

### GEO checks

- topical depth
- trust signals and EEAT-style metadata
- content freshness
- external links to authoritative sources
- comparison content
- citation likelihood signals

These checks are implemented as deterministic heuristics over parsed HTML and extracted text. They do not call an LLM to decide whether content passes.

## Inputs the package supports

`llm-citeops audit` can read content from:

- `--url <url>` for a single public page
- `--file <path>` for one local `.md`, `.markdown`, `.html`, or `.htm` file
- `--dir <path>` for a top-level directory of local content files
- `--sitemap <url>` for a remote sitemap or sitemap index

Notable implementation details:

- Markdown files are converted to HTML before auditing.
- Sitemap indexes are followed recursively.
- Public URLs are fetched in read-only mode with simple rate limiting.
- `robots.txt` is respected by default and can be overridden with `--ignore-robots`.
- The current package does not render JavaScript in a browser, so heavily client-rendered pages may be under-audited.

## Quick start

Run without installing globally:

```bash
npx llm-citeops overview
```

Install globally:

```bash
npm install -g llm-citeops
```

Audit a single live page:

```bash
llm-citeops audit --url "https://example.com/docs/article" --output html --output-path ./report.html
```

Audit a local file:

```bash
llm-citeops audit --file ./examples/sample.html --output json --output-path ./report.json
```

Audit a local content folder:

```bash
llm-citeops audit --dir ./examples --output csv --output-path ./batch.csv
```

Audit a sitemap:

```bash
llm-citeops audit --sitemap "https://example.com/sitemap.xml" --output csv --output-path ./site.csv
```

## How scoring works

Each audit returns:

- a category: `aeo` or `geo`
- a status: `pass`, `fail`, or `warn`
- a binary score used for rollups
- evidence explaining what was found
- an optional recommendation when the check does not pass

The package then computes:

- `aeo`
- `geo`
- `composite`
- a band: `poor`, `needs-improvement`, `good`, or `excellent`

By default:

- AEO contributes `0.5`
- GEO contributes `0.5`

Per-audit weights are also configurable. The built-in default weights emphasize checks such as:

- `faq_schema`
- `direct_answer`
- `qa_density`
- `topical_depth`
- `trust_signals`
- `citation_likelihood`

This makes the scoring explainable: you can trace the result back to named checks, visible evidence, and explicit weights.

## Recommendations

When an audit fails or warns, `llm-citeops` attaches a recommendation with:

- priority: `high`, `medium`, or `low`
- estimated score impact
- a concrete instruction
- in some cases, a code snippet

Examples of the built-in recommendation styles include:

- adding FAQPage or HowTo JSON-LD
- rewriting the first paragraph into a direct answer
- adding more question-based headings
- strengthening author and publisher signals
- adding external citations

## Output formats

The package currently supports:

- `html`
- `json`
- `csv`

Use `html` when a person will review the report.

Use `json` when another tool or script will consume it.

Use `csv` for batches, because CSV is the only format that currently emits one row per audited page.

Important current behavior:

- For `--dir` and `--sitemap` runs, `csv` includes all pages.
- For `--dir` and `--sitemap` runs, `html` and `json` currently write only the first report in the batch.

## Best practices for using the package well

Start with `--file` or `--url` before running batch audits. The recommendations are easier to inspect when you validate the rubric on one known page first.

Use `html` for editorial review and `json` or `csv` for automation. That matches how the package is implemented today.

Use `csv` for any meaningful directory or sitemap run. It is the only batch-safe output right now.

Treat the scores as a prioritization signal, not as a guarantee of search or citation performance. The package is heuristic by design.

Use `--ci` only after you understand your own baseline. The default threshold of `70` is a practical starting point, but it should not be treated as a universal standard.

If you audit live URLs, be deliberate with `--rate` and avoid `--ignore-robots` unless you explicitly control or have permission to crawl the site.

If your site depends on client-side rendering for main content, prefer auditing the underlying HTML output or local source exports because this package does not run a browser.

## Command reference

```text
llm-citeops overview
llm-citeops info

llm-citeops audit [options]
  --url <url>
  --file <path>
  --dir <path>
  --sitemap <url>
  --output <format>     html | json | csv
  --output-path <path>
  --threshold <n>
  --ci
  --ignore-robots
  --depth <n>
  --rate <n>
  --config <path>
  --probe
  --models <list>
  --compare <url>
```

Notes on flags that exist but are not active yet:

- `--probe` is present, but probe mode is currently stubbed and reports `enabled: false`.
- `--compare` is present as a future-facing option and is not implemented yet.
- `--depth` is accepted by the CLI, but the current crawler does not use it yet.

## CI mode

Use `--ci` to fail a run when the composite score is below the threshold.

```bash
llm-citeops audit --url "$DEPLOY_URL" --ci --threshold 70 --output json --output-path ./citeops-report.json
```

Exit codes:

| Exit code | Meaning |
|-----------|---------|
| 0 | Success |
| 1 | CI failure |
| 2 | Crawl or runtime error |
| 3 | Invalid input or config |

## Configuration

The package loads configuration from:

- `--config <path>`
- `.citeops.json` in the current project
- `.citeops.json` in the home directory

Example:

```json
{
  "audit": {
    "aeo_weight": 0.5,
    "geo_weight": 0.5,
    "custom_weights": {
      "faq_schema": 1.5,
      "direct_answer": 1.5,
      "citation_likelihood": 1.3
    }
  },
  "probe": {
    "enabled": false,
    "models": ["gpt4o", "claude"],
    "cache_ttl_days": 7
  },
  "ci": {
    "threshold": 70,
    "fail_on_drop": true
  }
}
```

Use it like this:

```bash
llm-citeops audit --url "https://example.com" --config ./.citeops.json
```

## Local development and verification

```bash
git clone https://github.com/rakeshcheekatimala/llm-citeops.git
cd llm-citeops
npm install
npm run lint
npm run build
npm test
npm run test:coverage
```

Useful smoke tests:

```bash
node dist/index.js audit --file ./examples/sample.html --output html --output-path ./sample-report.html
node dist/index.js audit --file ./examples/sample.md --output json --output-path ./sample-report.json
node dist/index.js audit --dir ./examples --output csv --output-path ./examples-report.csv
```

Coverage artifacts are written to:

- [coverage/index.html](/Users/rakeshcheekatimala/Desktop/Learnings/llm-citeops/coverage/index.html)
- [coverage/report.md](/Users/rakeshcheekatimala/Desktop/Learnings/llm-citeops/coverage/report.md)
- [coverage/summary.json](/Users/rakeshcheekatimala/Desktop/Learnings/llm-citeops/coverage/summary.json)

## Package health

Current project health from this repo state:

| Metric | Current status |
|------|----------------|
| Typecheck | `npm run lint` |
| Build | `npm run build` |
| Test suite | `npm test` |
| Coverage | `95.06%` lines, `82.33%` branches, `89.07%` functions |
| Built CLI bundle | `61.3 kB` for `dist/index.js` |
| npm package size | `428.8 kB` tarball |
| npm unpacked size | `545.0 kB` |

## Documentation

- [CONTRIBUTING.md](/Users/rakeshcheekatimala/Desktop/Learnings/llm-citeops/CONTRIBUTING.md)
- [docs/requirements.md](/Users/rakeshcheekatimala/Desktop/Learnings/llm-citeops/docs/requirements.md)
- [docs/suggestions.md](/Users/rakeshcheekatimala/Desktop/Learnings/llm-citeops/docs/suggestions.md)

## Limitations

The current implementation has a few deliberate limits:

- no browser rendering for JavaScript-heavy pages
- no live probe execution despite the reserved `--probe` flag
- no implemented compare workflow despite the reserved `--compare` flag
- no recursive local directory traversal
- no batch HTML or JSON aggregation beyond the first report

These are good candidates for future improvement, but the README above reflects the package as it behaves now.

## License

MIT
