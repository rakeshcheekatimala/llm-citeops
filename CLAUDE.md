# Claude Code Instructions for answerlint

This document provides project-specific guidance for Claude Code agents working in this repository.


Write, Edit, Glob remain unchanged.

## Project Overview

**answerlint** is a TypeScript/Node.js tool for automated web auditing with citations.

- **Main entry**: src/cli/
- **Audits**: src/audits/ (aeo, seo, performance, security)
- **Crawler**: src/crawler/ (robots, sitemap, url-fetcher, local-parser)
- **Tests**: tests/ (unit + integration)
- **Output**: HTML/CSV/JSON reports

## Key Conventions

1. **Testing**: Unit tests in tests/, integration tests use crawler mock or local files
2. **Audits**: Each audit in src/audits/ returns findings with citations
3. **Config**: src/config/ handles validation
4. **No external dependencies** for core crawling logic
5. **TypeScript strict mode enabled**

## Development Workflow

- Branch naming: feature/*, fix/*, docs/*
- Commit: semantic commit messages (feat:, fix:, docs:, test:, refactor:)
- PR: Reference related issues, include test updates
- Pre-commit: husky + lint-staged (npm run lint)

