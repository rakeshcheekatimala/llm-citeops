import fs from 'fs';
import { LlmsIssue, LlmsLintResult } from './types.js';

interface ParsedLink {
  url: string;
  hasNotes: boolean;
  line: number;
}

const LINK_ITEM_RE = /^-\s+\[([^\]]+)\]\(([^)]+)\)(?::\s+(.+))?\s*$/;

export function lintLlmsText(
  content: string,
  options: { strict: boolean; maxChars: number }
): LlmsLintResult {
  const issues: LlmsIssue[] = [];
  const normalized = content.replace(/^\uFEFF/, '');
  const lines = normalized.split(/\r?\n/);
  const links: ParsedLink[] = [];

  if (normalized.length > options.maxChars) {
    issues.push({
      severity: 'warn',
      message: `File is ${normalized.length} characters, above the configured ${options.maxChars} character budget.`,
    });
  }

  const firstContentIndex = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentIndex === -1) {
    issues.push({ severity: 'error', message: 'llms.txt is empty.' });
    return buildResult(issues, options.strict);
  }

  if (!/^#\s+\S/.test(lines[firstContentIndex])) {
    issues.push({
      severity: 'error',
      line: firstContentIndex + 1,
      message: 'The first non-empty line must be an H1 site or project title.',
    });
  }

  const h1Lines = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^#\s+/.test(line.trim()));
  if (h1Lines.length !== 1) {
    issues.push({
      severity: 'error',
      message: `Expected exactly one H1 heading, found ${h1Lines.length}.`,
    });
  }

  if (!lines.some((line) => /^>\s+\S/.test(line.trim()))) {
    issues.push({
      severity: 'warn',
      message: 'Add a blockquote summary after the H1 so agents understand the site quickly.',
    });
  }

  validateSections(lines, links, issues);
  validateLinks(links, issues);

  return buildResult(issues, options.strict);
}

export function lintLlmsFile(
  filePath: string,
  options: { strict: boolean; maxChars: number }
): LlmsLintResult {
  if (!fs.existsSync(filePath)) {
    return buildResult(
      [{ severity: 'error', message: `File not found: ${filePath}` }],
      options.strict
    );
  }

  return lintLlmsText(fs.readFileSync(filePath, 'utf-8'), options);
}

function validateSections(
  lines: string[],
  links: ParsedLink[],
  issues: LlmsIssue[]
): void {
  let currentSection: { title: string; line: number; itemCount: number } | null = null;
  let hasSection = false;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();
    const lineNumber = index + 1;

    if (/^#{3,}\s+/.test(line)) {
      issues.push({
        severity: 'warn',
        line: lineNumber,
        message: 'llms.txt should keep file lists under H2 sections; avoid deeper headings.',
      });
      continue;
    }

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      if (currentSection && currentSection.itemCount === 0) {
        issues.push({
          severity: 'error',
          line: currentSection.line,
          message: `Section "${currentSection.title}" does not contain any file links.`,
        });
      }

      currentSection = { title: h2[1].trim(), line: lineNumber, itemCount: 0 };
      hasSection = true;
      continue;
    }

    if (!currentSection || line.length === 0) continue;

    if (!line.startsWith('- ')) {
      issues.push({
        severity: 'error',
        line: lineNumber,
        message: `Section "${currentSection.title}" must contain Markdown list links only.`,
      });
      continue;
    }

    const link = line.match(LINK_ITEM_RE);
    if (!link || !link[1].trim() || !link[2].trim()) {
      issues.push({
        severity: 'error',
        line: lineNumber,
        message: 'List items must use "- [Title](https://example.com): optional notes".',
      });
      continue;
    }

    currentSection.itemCount += 1;
    links.push({
      url: link[2].trim(),
      hasNotes: Boolean(link[3]?.trim()),
      line: lineNumber,
    });
  }

  if (currentSection && currentSection.itemCount === 0) {
    issues.push({
      severity: 'error',
      line: currentSection.line,
      message: `Section "${currentSection.title}" does not contain any file links.`,
    });
  }

  if (!hasSection) {
    issues.push({
      severity: 'error',
      message: 'Add at least one H2 section containing Markdown file links.',
    });
  }
}

function validateLinks(links: ParsedLink[], issues: LlmsIssue[]): void {
  const seen = new Map<string, number>();

  for (const link of links) {
    if (!isValidHttpUrl(link.url)) {
      issues.push({
        severity: 'error',
        line: link.line,
        message: `Link URL must be an absolute http(s) URL: ${link.url}`,
      });
      continue;
    }

    const previousLine = seen.get(link.url);
    if (previousLine) {
      issues.push({
        severity: 'error',
        line: link.line,
        message: `Duplicate URL also appears on line ${previousLine}: ${link.url}`,
      });
    } else {
      seen.set(link.url, link.line);
    }

    if (isPrivateOrInternalUrl(link.url)) {
      issues.push({
        severity: 'error',
        line: link.line,
        message: `Do not publish private, local, admin, or draft URLs in llms.txt: ${link.url}`,
      });
    }

    if (!link.hasNotes) {
      issues.push({
        severity: 'warn',
        line: link.line,
        message: 'Add a short description after ":" so agents know why this link matters.',
      });
    }
  }
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPrivateOrInternalUrl(value: string): boolean {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();

  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    /\/(admin|draft|drafts|internal|private)(\/|$)/.test(pathname)
  );
}

function buildResult(issues: LlmsIssue[], strict: boolean): LlmsLintResult {
  const errorCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warn').length;

  return {
    valid: errorCount === 0 && (!strict || warningCount === 0),
    issues,
    errorCount,
    warningCount,
  };
}
