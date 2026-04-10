# Contributing to llm-citeops

Thanks for contributing to `llm-citeops`.

This project aims to stay simple, deterministic, and useful for operators. The core idea is:

- audit first
- score with explainable heuristics
- generate actionable fixes
- keep outputs reusable across CLI and future UI layers

## Development setup

Requirements:

- Node.js 18+

Install and build:

```bash
git clone https://github.com/rakeshcheekatimala/llm-citeops.git
cd llm-citeops
npm install
npm run lint
npm run build
```

Useful scripts:

```bash
npm run dev
npm run lint
npm run build
npm test
npm run test:coverage
npm run size:bundle
npm run size:pack
```

Coverage artifacts are written to:

- `coverage/index.html`
- `coverage/report.md`
- `coverage/summary.json`

## Project shape

High-level directories:

- `src/cli` command entrypoints
- `src/audits` AEO and GEO checks
- `src/scoring` score rollups and bands
- `src/recommendations` fix generation for failed checks
- `src/reporters` HTML, JSON, and CSV output
- `examples` local fixtures and smoke-test inputs
- `templates` Handlebars templates for reports

## Contribution principles

Please keep changes aligned with these constraints:

- Prefer deterministic heuristics over opaque model judging.
- Keep scores explainable. New scores should say what evidence contributed.
- Reuse report data structures instead of reimplementing logic in multiple places.
- Treat live data collection carefully. Respect rate limits, public endpoints, and partial-data failure modes.
- Degrade gracefully when data is missing or blocked.
- Avoid overclaiming. Reports should be directional and evidence-backed, not absolute.

## Making changes

### CLI changes

If you add or change a command:

- update the command wiring in `src/cli`
- update output handling if new report formats are involved
- document the new command in `README.md`
- add a local example or fixture when practical

### Audit or scoring changes

If you change audits, scoring, or recommendations:

- keep the logic deterministic
- update related types
- make sure evidence text still matches the score behavior
- add or update fixtures so the change is testable

## How to test

Run these before opening a PR:

```bash
npm run lint
npm run build
npm test
npm run test:coverage
```

Recommended smoke tests:

### Core audit

```bash
node dist/index.js audit --file ./README.md --output json --output-path ./test-report.json
```


## Coding style

This repo is intentionally lightweight. A few preferences:

- use TypeScript with clear types
- keep functions small and composable
- prefer explicit logic over clever shortcuts
- keep comments short and only where they help
- stick to ASCII unless the file already uses something else

## Documentation

Update docs when behavior changes. In most cases that means:

- `README.md` for user-facing CLI changes
- `docs/requirements.md` for product or rubric changes
- `docs/suggestions.md` for follow-up improvements, roadmap ideas, and adoption fixes
- fixtures in `examples/` when test coverage needs a stable input

## Bug reports and ideas

If you open an issue or PR, helpful context includes:

- command used
- input flags
- expected behavior
- actual behavior
- sample URL or fixture, if shareable
- terminal output or warning text

## Release notes

Releases are automated with `semantic-release` from `main`.

Please use conventional commits for any change that should influence the published version:

- `fix:` for a patch release
- `feat:` for a minor release
- `feat!:` or a `BREAKING CHANGE:` footer for a major release
- `docs:`, `test:`, and `chore:` for changes that should not publish by themselves

If your change affects users, include enough context in the PR description for the generated GitHub release notes to stay readable.
