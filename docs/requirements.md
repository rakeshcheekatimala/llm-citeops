# citeops — requirements.md

> A Lighthouse-inspired CLI tool that audits web content for AEO (Answer Engine Optimization) and GEO (Generative Engine Optimization) scores, and delivers actionable recommendations to improve AI citation visibility.

---

## 1. Product overview

### 1.1 Vision

Citeops is a CLI audit tool that tells content and product teams how well their pages perform inside LLM-generated responses — and shows them exactly what to change to improve that performance. It is to AI visibility what Google Lighthouse is to web performance.

Like Lighthouse, citeops does **not** edit your content. It audits any URL or local file, scores it across 12 AEO/GEO checks, and produces a detailed report with prioritized, copy-paste-ready recommendations for every failing audit.

> **Lighthouse principle:** citeops tells you what is wrong, why it matters, and exactly how to fix it. You implement the fix.

### 1.2 Core user personas

| Persona | Goal | Primary use |
|---|---|---|
| Content strategist | Improve AI citation rate for articles | Run audits, follow fix recommendations |
| Frontend / full-stack engineer | Gate CI/CD pipelines on AEO/GEO score | CLI integration, score thresholds |
| SEO / GEO specialist | Benchmark against competitors | Audit any URL, compare scores |
| DevOps / platform engineer | Automate site-wide audits | Batch mode via sitemap |

### 1.3 Non-goals (v1)

- Does not edit, patch, or rewrite any content automatically
- No browser extension (CLI-first)
- No real-time monitoring dashboard
- No fine-tuning or training of LLMs
- No support for paywalled / authenticated pages

---

## 2. Scoring architecture

### 2.1 Three-layer model

```
Layer 1  →  Raw audits       binary pass/fail per check (no LLM required)
Layer 2  →  Category scores  AEO score (0–100) + GEO score (0–100)
Layer 3  →  Composite        Weighted composite + community percentile (Phase 3)
```

### 2.2 AEO audit checklist (Layer 1)

| Audit | Method | Default weight |
|---|---|---|
| FAQ / HowTo schema present | JSON-LD parser | ×1.5 |
| Direct answer in first paragraph | Regex + NLP heuristic | ×1.5 |
| Q&A density (questions per 500 words) | Token counter | ×1.5 |
| Readability grade ≤ 10 | Flesch-Kincaid | ×1.0 |
| Named entity coverage | NER (compromise.js) | ×1.0 |
| Author byline + credentials present | HTML parser | ×1.0 |

### 2.3 GEO audit checklist (Layer 1)

| Audit | Method | Default weight |
|---|---|---|
| Topical depth score (subtopic coverage) | TF-IDF + outline analysis | ×1.3 |
| Trust signals (EEAT) — author, org, sources | HTML + metadata parser | ×1.3 |
| Content freshness (publish / modified date) | Schema + meta tags | ×1.2 |
| External citation / link quality | Link resolver | ×1.0 |
| Comparison content present | Heading + content classifier | ×1.0 |
| Citation likelihood signals | Composite heuristic | ×1.3 |

### 2.4 Composite score formula

```
AEO_score  = weighted_avg(AEO audits) × 100
GEO_score  = weighted_avg(GEO audits) × 100
Composite  = (AEO_score × 0.5) + (GEO_score × 0.5)
Percentile = rank against opt-in community benchmark dataset  [Phase 3]
```

Weights are user-configurable via `.citeops.json`.

### 2.5 Score bands

| Score | Band | Color |
|---|---|---|
| 0 – 49 | Poor | Red |
| 50 – 74 | Needs improvement | Amber |
| 75 – 89 | Good | Green |
| 90 – 100 | Excellent | Bright green |

---

## 3. Inputs and data sources

### 3.1 Supported input types

| Input | CLI flag | Notes |
|---|---|---|
| Single URL | `--url` | Fetches and parses live page (read-only) |
| Sitemap | `--sitemap` | Crawls all URLs in sitemap.xml |
| Local markdown file | `--file` | Audits pre-publish content |
| Local HTML file | `--file` | Same as above |
| Directory of files | `--dir` | Batch audit |

### 3.2 Crawl behavior

- Respects `robots.txt` by default; override with `--ignore-robots`
- Max crawl depth configurable: `--depth <n>` (default: 1)
- Rate limiting: 1 req/s default; configurable with `--rate <n>`
- Timeout per page: 15s default

---

## 4. Recommendation engine

For every failing audit, citeops generates a structured recommendation block that includes:

1. **What failed** — the exact element, text, or missing signal (evidence snippet)
2. **Why it matters** — one-sentence explanation of how this affects AEO/GEO citation rate
3. **Priority** — High / Medium / Low based on audit weight
4. **Estimated score impact** — how many composite points fixing this is worth
5. **How to fix** — step-by-step instruction + a copy-paste ready code block where applicable

### 4.1 Recommendation catalog

| Failing audit | Recommendation type | Code snippet provided |
|---|---|---|
| FAQ / HowTo schema missing | Add JSON-LD block to `<head>` | Yes — full FAQPage or HowTo JSON-LD |
| No direct answer in paragraph 1 | Rewrite instruction + target sentence identified | Yes — identifies the best existing sentence to move |
| Low Q&A density | Add question headings guidance | Yes — list of suggested H2/H3 questions to add |
| Readability grade > 10 | Sentence simplification guidance | Yes — flags the specific overlong/complex sentences |
| Low named entity coverage | Entity addition guidance | Yes — lists detected gaps (missing people, org, location entities) |
| Author byline missing | Add author markup | Yes — `<span rel="author">` + Schema Person template |
| Low topical depth | Subtopic coverage gaps | Yes — lists the TF-IDF terms with no matching heading |
| EEAT signals weak | Trust signal checklist | Yes — missing Schema fields enumerated |
| Content stale | Update date markup | Yes — `dateModified` field to update in existing Schema |
| Weak external links | Citation quality guidance | Yes — identifies which links need replacing and criteria |
| No comparison content | Comparison section guidance | No — editorial suggestion only |
| Low citation likelihood | Composite fix checklist | No — summarizes top 3 highest-impact fixes from above |

### 4.2 Recommendation output format

Each recommendation in the report follows this structure:

```
┌─ FAIL  FAQ / HowTo schema missing                    [AEO · High · +8 pts] ─┐
│                                                                               │
│  Why it matters                                                               │
│  LLMs heavily weight structured FAQ schema when selecting content to cite    │
│  in answer responses. Pages without it are deprioritized in AI summaries.    │
│                                                                               │
│  Evidence                                                                     │
│  No <script type="application/ld+json"> with @type FAQPage or HowToStep     │
│  found in <head>.                                                             │
│                                                                               │
│  How to fix  — add this to your <head>:                                      │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│  <script type="application/ld+json">                                          │
│  {                                                                            │
│    "@context": "https://schema.org",                                          │
│    "@type": "FAQPage",                                                        │
│    "mainEntity": [                                                             │
│      {                                                                        │
│        "@type": "Question",                                                   │
│        "name": "What is React hooks?",                                        │
│        "acceptedAnswer": {                                                    │
│          "@type": "Answer",                                                   │
│          "text": "React hooks are functions that let you use state..."        │
│        }                                                                      │
│      }                                                                        │
│    ]                                                                          │
│  }                                                                            │
│  </script>                                                                    │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. LLM probe mode

### 5.1 Purpose

Query real LLMs with topic-relevant questions and measure whether the target page is cited, paraphrased, or surfaced. Provides ground-truth visibility signal beyond heuristic scoring — the difference between "your page passes the checks" and "your page is actually being cited."

### 5.2 Tiered model roster

| Tier | Models | Default | Notes |
|---|---|---|---|
| Tier 1 (always on) | GPT-4o, Claude 3.5 Sonnet | Yes | Highest market share |
| Tier 2 (opt-in) | Gemini 1.5 Pro, Perplexity | No | Web-grounded, citation-native |
| Tier 3 (power users) | Llama 3 via Ollama | No | No API cost, requires local infra |

Enable via: `--probe --models gpt4o,claude` or configure in `.citeops.json`.

### 5.3 Probe query generation

Auto-generated from page content:

1. Extract H1, primary entity, and top 5 TF-IDF terms
2. Generate 10 queries per page:
   - 5 informational: "What is {entity}?", "How does {topic} work?"
   - 5 comparison: "What is the best {category}?", "{entity} vs alternatives?"
3. Run each query against selected probe models
4. Score = (times cited or meaningfully paraphrased) / 10, per model

### 5.4 Normalization

- Per-model visibility score reported separately
- Weighted composite: Tier 1 models weighted 60%, Tier 2 at 40%
- Results cached for 7 days to avoid redundant API calls

---

## 6. CLI interface specification

### 6.1 Installation

```bash
npm install -g llm-citeops
# or
npx llm-citeops audit --url <url>
```

### 6.2 Core commands

```bash
# Basic audit — any URL (read-only, generates recommendations)
llm-citeops audit --url https://example.com/page

# Audit a competitor page
llm-citeops audit --url https://competitor.com/article

# Audit a local file before publishing
llm-citeops audit --file ./content/article.md

# Batch audit — full site via sitemap
llm-citeops audit --sitemap https://example.com/sitemap.xml

# With LLM probe — measure actual citation visibility
llm-citeops audit --url https://example.com/page --probe --models gpt4o,claude

# Compare your page against a competitor
llm-citeops audit --url https://example.com/page --compare https://competitor.com/page

# CI mode — exits with code 1 if composite score below threshold
llm-citeops audit --url https://example.com/page --threshold 70 --ci

# Save report to specific path
llm-citeops audit --url https://example.com/page --output json --output-path ./report.json
```

### 6.3 Output formats

```bash
--output html     # Full HTML report (default) — Lighthouse-inspired
--output json     # Machine-readable, CI-friendly
--output csv      # Batch summary across multiple URLs
```

### 6.4 Configuration file — `.citeops.json`

```json
{
  "audit": {
    "aeo_weight": 0.5,
    "geo_weight": 0.5,
    "custom_weights": {
      "faq_schema": 1.5,
      "qa_density": 1.5,
      "topical_depth": 1.3
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

---

## 7. CI/CD integration

### 7.1 GitHub Actions example

```yaml
- name: LLM citeops audit
  run: |
    npx llm-citeops audit \
      --url ${{ env.STAGING_URL }} \
      --threshold 70 \
      --ci \
      --output json \
      --output-path ./citeops-report.json

- name: Upload report
  uses: actions/upload-artifact@v3
  with:
    name: llm-citeops-report
    path: ./citeops-report.json
```

### 7.2 Exit codes

| Code | Meaning |
|---|---|
| 0 | Audit passed, composite score ≥ threshold |
| 1 | Audit failed, composite score < threshold |
| 2 | Network / crawl error |
| 3 | Invalid configuration |

---

## 8. Report structure

### 8.1 HTML report sections

The HTML report is a single self-contained file, styled like a Lighthouse report.

1. **Score summary** — composite gauge (0–100), AEO score, GEO score, score band label, percentile rank (Phase 3)
2. **Passed audits** — collapsed list of checks that passed with evidence
3. **Recommendations** — expanded list of failing checks, ordered by estimated score impact (highest first), each with the full recommendation block (§4.2)
4. **Probe results** (if `--probe` enabled) — per-model visibility score, query log, citation evidence
5. **Competitor comparison** (if `--compare` used) — side-by-side score table

### 8.2 JSON report schema

```json
{
  "url": "https://example.com/page",
  "timestamp": "2026-04-04T10:00:00Z",
  "scores": {
    "composite": 74,
    "aeo": 78,
    "geo": 70,
    "band": "needs-improvement",
    "percentile": null
  },
  "audits": [
    {
      "id": "faq_schema",
      "category": "aeo",
      "status": "fail",
      "weight": 1.5,
      "score": 0,
      "evidence": "No FAQPage or HowTo JSON-LD found in <head>.",
      "recommendation": {
        "priority": "high",
        "score_impact": 8,
        "instruction": "Add FAQ schema to your <head>",
        "code_snippet": "<script type=\"application/ld+json\">...</script>"
      }
    }
  ],
  "probe": {
    "enabled": false,
    "results": []
  }
}
```

---

## 9. Phased delivery plan

### Phase 1 — v1 (core audit + recommendations)

- [ ] CLI scaffold — Node.js + TypeScript, commander.js, chalk, ora
- [ ] Crawler — URL fetcher (node-fetch), HTML parser (cheerio), sitemap walker, robots.txt
- [ ] Local file support — `.md` and `.html` parsing
- [ ] AEO audit suite — 6 checks
- [ ] GEO audit suite — 6 checks
- [ ] Scoring engine — weighted_avg, composite formula, configurable weights
- [ ] Recommendation engine — per-failing-audit code snippets and instructions (§4.1)
- [ ] HTML report — Lighthouse-inspired, self-contained single file (Handlebars)
- [ ] JSON report — full schema per §8.2
- [ ] CSV report — batch summary
- [ ] CI mode — `--threshold`, exit codes
- [ ] `.citeops.json` config support

### Phase 2 — v2 (LLM probe mode)

- [ ] Probe query generator — H1 + TF-IDF extraction, 10 query templates per page
- [ ] Model connectors — GPT-4o (Tier 1), Claude 3.5 Sonnet (Tier 1)
- [ ] Opt-in connectors — Gemini 1.5 Pro, Perplexity (Tier 2)
- [ ] Ollama connector — Llama 3 self-hosted (Tier 3)
- [ ] Citation detection — URL mention, domain mention, semantic paraphrase match
- [ ] Per-model scoring + weighted composite visibility score
- [ ] 7-day result cache (`~/.citeops/cache/`)
- [ ] Probe results section in HTML + JSON report

### Phase 3 — v3 (competitor comparison + benchmarks)

- [ ] `--compare <url>` — side-by-side audit of your page vs. competitor
- [ ] Community benchmark dataset — opt-in anonymized telemetry
- [ ] Percentile rank computation against benchmark dataset
- [ ] Benchmark dataset hosting (Cloudflare R2)
- [ ] Trend tracking — re-audit same URL over time, plot score history

---

## 10. Open engineering decisions

| Decision | Options | Recommendation |
|---|---|---|
| Runtime | Node.js vs Python | Node.js — aligns with Lighthouse ecosystem |
| NLP for AEO audits | spaCy (Python) vs compromise.js | compromise.js for pure-Node v1 |
| HTML templating | Handlebars vs EJS | Handlebars — logic-free templates, cleaner |
| Benchmark dataset | Self-hosted vs crowdsourced opt-in | Opt-in telemetry with anonymization, hosted on Cloudflare R2 |
| Probe query quality | Rule-based vs LLM-generated | Rule-based in v1; LLM-generated probes in v2 |
| Auth for probe LLM APIs | Per-user keys vs proxy | User supplies own keys via env vars (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) |
