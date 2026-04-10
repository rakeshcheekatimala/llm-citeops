import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as cheerio from 'cheerio';
import type { AuditContext, AuditResult, Report } from '../src/types/index.ts';

export class ExitCalledError extends Error {
  constructor(public readonly code: number) {
    super(`process.exit(${code}) called`);
  }
}

export function createTempDir(prefix = 'citeops-test-'): string {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

export function fixturePath(...parts: string[]): string {
  return path.join(process.cwd(), ...parts);
}

export function readFixture(...parts: string[]): string {
  return readFileSync(fixturePath(...parts), 'utf-8');
}

export function makeContext(
  html: string,
  url = 'https://example.com/article'
): AuditContext {
  const $ = cheerio.load(html);
  const textRoot = $('body').length ? $('body').clone() : $.root().clone();
  textRoot.find('script, style, noscript').remove();

  return {
    url,
    html,
    text: textRoot.text().replace(/\s+/g, ' ').trim(),
    $,
  };
}

export function repeatSentence(sentence: string, count: number): string {
  return Array.from({ length: count }, () => sentence).join(' ');
}

export function makeAuditResult(overrides: Partial<AuditResult> = {}): AuditResult {
  return {
    id: 'faq_schema',
    category: 'aeo',
    title: 'FAQ / HowTo schema present',
    status: 'fail',
    weight: 1.5,
    score: 0,
    evidence: 'Missing schema.',
    ...overrides,
  };
}

export function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    url: 'https://example.com/page',
    timestamp: '2026-01-01T00:00:00.000Z',
    scores: {
      composite: 80,
      aeo: 85,
      geo: 75,
      band: 'good',
      percentile: null,
    },
    audits: [makeAuditResult()],
    probe: {
      enabled: false,
      results: [],
    },
    ...overrides,
  };
}

export async function captureConsole<T>(
  fn: () => Promise<T> | T
): Promise<{ result: T; logs: string[]; errors: string[] }> {
  const logs: string[] = [];
  const errors: string[] = [];
  const origLog = console.log;
  const origError = console.error;

  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  };

  try {
    const result = await fn();
    return { result, logs, errors };
  } finally {
    console.log = origLog;
    console.error = origError;
  }
}

export function patchProcessExit(): () => void {
  const original = process.exit;

  process.exit = ((code?: number) => {
    throw new ExitCalledError(code ?? 0);
  }) as typeof process.exit;

  return () => {
    process.exit = original;
  };
}
