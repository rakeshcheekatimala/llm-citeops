# Suggestions

This document collects practical follow-up improvements for `llm-citeops` so they can be picked up later without crowding the main package documentation.

## Near-term improvements

### 1. Release confidence

- Add GitHub Actions for `lint`, `build`, `test`, and `test:coverage`
- Publish coverage and test status as CI artifacts
- Add release notes or a changelog for each published version

Why it matters:

- helps other users trust the package quickly
- makes regressions visible earlier
- improves maintainability for future contributors

### 2. Package discoverability

- Expand npm keywords beyond `aeo`, `geo`, and `seo`
- Add a short “who this package is for” section on the npm homepage and README top area
- Include one or two report screenshots or sample outputs in `docs/`

Why it matters:

- improves first-run clarity
- makes the package easier to understand from npm or GitHub alone

### 3. Report ergonomics

- Add schema versioning to JSON reports
- Add a concise machine-readable summary block for automation consumers
- Consider a smaller terminal summary mode for CI logs

Why it matters:

- makes integrations safer
- keeps output stable as the package evolves

### 4. Test depth

- Add regression fixtures for tricky content shapes
- Add snapshot-style checks for HTML and JSON report structure
- Improve branch coverage in lower-covered utilities and orchestration paths

Why it matters:

- protects the package from subtle behavior drift
- makes refactoring safer

## Product and UX ideas

### 1. Better package defaults

- Auto-suggest output file names more clearly in terminal output
- Explain score bands directly in the terminal summary
- Surface top 3 recommendations first in CLI output

### 2. Better onboarding

- Add a `docs/examples.md` page with common commands
- Add a `.citeops.json` example file
- Add “when to use `html`, `json`, or `csv`” examples

### 3. Clearer boundaries

- Mark reserved or future-facing flags such as `--probe` and `--compare` more explicitly
- Document what is intentionally heuristic versus guaranteed behavior
- Add a simple architecture note showing crawl, audit, scoring, and reporting stages

## Recommended order

If time is limited, this is the highest-value sequence:

1. Add GitHub Actions for lint, build, test, and coverage
2. Add JSON schema versioning and report stability notes
3. Add example configs and sample outputs
4. Improve lower-coverage branches in orchestration and utility paths
5. Add release notes and better npm/package metadata
