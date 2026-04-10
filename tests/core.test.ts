import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { loadConfig, getWeight } from '../.test-dist/config/index.js';
import { createContentDom, extractPrimaryContent } from '../.test-dist/utils/content.js';
import { getRootDomain, isExternalUrl } from '../.test-dist/utils/url.js';
import { computeScores, bandColor, bandLabel } from '../.test-dist/scoring/index.js';
import { generateRecommendations } from '../.test-dist/recommendations/index.js';
import { generateJsonReport } from '../.test-dist/reporters/json.js';
import { generateCsvReport } from '../.test-dist/reporters/csv.js';
import { generateHtmlReport } from '../.test-dist/reporters/html.js';
import { resolveOutputPath } from '../.test-dist/cli/commands/audit.js';
import {
  createTempDir,
  makeAuditResult,
  makeReport,
  repeatSentence,
} from './helpers.ts';

test('content utilities strip chrome and extract the main article body', () => {
  const html = `
    <html><body>
      <nav>Navigation</nav>
      <main>
        <article>${repeatSentence('Main content is here and should be preserved.', 30)}</article>
      </main>
      <footer>Footer</footer>
      <script>window.alert('ignore')</script>
    </body></html>
  `;

  const $ = createContentDom(html);
  assert.equal($('nav').length, 0);
  assert.equal($('script').length, 0);

  const extracted = extractPrimaryContent($.root());
  assert.equal(extracted.rootSelector, 'article');
  assert.match(extracted.text, /Main content/);
});

test('content extraction falls back to body when no strong container exists', () => {
  const html = `<html><body>${repeatSentence('Fallback body content stays readable.', 30)}</body></html>`;
  const extracted = extractPrimaryContent(createContentDom(html));
  assert.equal(extracted.rootSelector, 'body');
});

test('URL helpers normalize root domains and external link checks', () => {
  assert.equal(getRootDomain('https://docs.example.co.uk/page'), 'example.co.uk');
  assert.equal(getRootDomain('sub.example.com'), 'example.com');
  assert.equal(isExternalUrl('https://developer.mozilla.org/docs/Web/HTML', 'https://example.com/post'), true);
  assert.equal(isExternalUrl('mailto:team@example.com', 'https://example.com/post'), false);
  assert.equal(isExternalUrl('https://blog.example.com/post', 'https://example.com/post'), false);
  assert.equal(isExternalUrl('not-a-url', 'https://example.com/post'), false);
});

test('config loader returns defaults, merges overrides, and surfaces invalid JSON', () => {
  const tempDir = createTempDir();
  const validConfigPath = path.join(tempDir, 'config.json');
  fs.writeFileSync(
    validConfigPath,
    JSON.stringify({
      audit: { aeo_weight: 0.6, custom_weights: { faq_schema: 2 } },
      ci: { threshold: 80 },
    }),
    'utf-8'
  );

  const loaded = loadConfig(validConfigPath);
  assert.equal(loaded.audit.aeo_weight, 0.6);
  assert.equal(loaded.audit.geo_weight, 0.5);
  assert.equal(loaded.audit.custom_weights.faq_schema, 2);
  assert.equal(loaded.ci.threshold, 80);
  assert.equal(getWeight(loaded, 'faq_schema'), 2);
  assert.equal(getWeight(loaded, 'unknown_audit'), 1);

  const defaults = loadConfig(path.join(tempDir, 'missing.json'));
  assert.equal(defaults.audit.aeo_weight, 0.5);

  const invalidConfigPath = path.join(tempDir, 'invalid.json');
  fs.writeFileSync(invalidConfigPath, '{oops', 'utf-8');
  assert.throws(() => loadConfig(invalidConfigPath), /Invalid JSON/);
});

test('scoring computes weighted results and score bands', () => {
  const audits = [
    makeAuditResult({ id: 'faq_schema', category: 'aeo', weight: 1.5, status: 'pass', score: 1 }),
    makeAuditResult({ id: 'direct_answer', category: 'aeo', weight: 1.5, status: 'fail', score: 0 }),
    makeAuditResult({ id: 'trust_signals', category: 'geo', weight: 1.3, status: 'pass', score: 1 }),
    makeAuditResult({ id: 'external_links', category: 'geo', weight: 1.0, status: 'fail', score: 0 }),
  ];
  const config = loadConfig();

  const scores = computeScores(audits, config);
  assert.deepEqual(scores, {
    aeo: 50,
    geo: 57,
    composite: 53,
    band: 'needs-improvement',
    percentile: null,
  });
  assert.equal(bandColor('poor'), '#ff4e42');
  assert.equal(bandLabel('excellent'), 'Excellent');
});

test('recommendation engine enriches failing known audits and leaves pass/unknown audits alone', () => {
  const audits = [
    makeAuditResult({ id: 'faq_schema', weight: 1.5, status: 'fail', score: 0 }),
    makeAuditResult({ id: 'custom_unknown', weight: 0.5, status: 'fail', score: 0 }),
    makeAuditResult({ id: 'direct_answer', weight: 1.5, status: 'pass', score: 1 }),
  ];

  const results = generateRecommendations(audits);
  assert.equal(results[0].recommendation?.priority, 'high');
  assert.equal(results[1].recommendation, undefined);
  assert.equal(results[2].recommendation, undefined);
});

test('JSON, CSV, and HTML reporters return content and write files', () => {
  const tempDir = createTempDir();
  const report = makeReport({
    audits: [
      makeAuditResult({ status: 'fail', recommendation: undefined }),
      makeAuditResult({ id: 'direct_answer', status: 'pass', score: 1 }),
      makeAuditResult({ id: 'readability', status: 'warn', score: 0 }),
    ],
  });

  const jsonPath = path.join(tempDir, 'report.json');
  const csvPath = path.join(tempDir, 'report.csv');
  const htmlPath = path.join(tempDir, 'report.html');

  const json = generateJsonReport(report, jsonPath);
  const csv = generateCsvReport([report], csvPath);
  const html = generateHtmlReport(report, htmlPath);

  assert.equal(JSON.parse(json).url, report.url);
  assert.match(csv, /pass_count,fail_count,warn_count/);
  assert.match(html, /citeops Report/);
  assert.equal(fs.existsSync(jsonPath), true);
  assert.equal(fs.existsSync(csvPath), true);
  assert.equal(fs.existsSync(htmlPath), true);
});

test('CSV reporter escapes fields with commas, quotes, and new lines', () => {
  const report = makeReport({
    url: 'https://example.com/a,b',
    timestamp: '2026-01-01\n00:00:00Z',
  });
  const csv = generateCsvReport([report]);
  assert.match(csv, /"https:\/\/example.com\/a,b"/);
  assert.match(csv, /"2026-01-01/);
});

test('output path resolver respects explicit paths and format defaults', () => {
  const explicit = resolveOutputPath('./custom.json', 'json');
  assert.ok(explicit.endsWith(path.join('', 'custom.json')));

  const htmlDefault = resolveOutputPath(undefined, 'html');
  const csvDefault = resolveOutputPath(undefined, 'csv');
  assert.ok(htmlDefault.endsWith('citeops-report.html'));
  assert.ok(csvDefault.endsWith('citeops-report.csv'));
});
