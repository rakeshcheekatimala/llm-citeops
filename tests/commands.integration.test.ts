import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { runAudit } from '../.test-dist/cli/commands/audit.js';
import { runDiff } from '../.test-dist/cli/commands/diff.js';
import { runOverview } from '../.test-dist/cli/commands/overview.js';
import {
  captureConsole,
  createTempDir,
  ExitCalledError,
  fixturePath,
  makeAuditResult,
  makeReport,
  patchProcessExit,
  readFixture,
} from './helpers.ts';

test('overview command prints the capability dashboard', async () => {
  const { logs } = await captureConsole(() => runOverview('1.2.3'));
  const output = logs.join('\n');
  assert.match(output, /answerlint/);
  assert.match(output, /automated checks/);
});

test('runAudit writes JSON, CSV, and HTML reports successfully', async () => {
  const tempDir = createTempDir();
  const jsonPath = path.join(tempDir, 'report.json');
  const csvPath = path.join(tempDir, 'report.csv');
  const htmlPath = path.join(tempDir, 'report.html');

  await captureConsole(() =>
    runAudit({
      file: fixturePath('examples', 'sample.html'),
      output: 'json',
      outputPath: jsonPath,
      probe: false,
      models: ['gpt4o'],
      threshold: 70,
      ci: false,
      ignoreRobots: false,
      depth: 1,
      rate: 1,
    })
  );

  await captureConsole(() =>
    runAudit({
      dir: fixturePath('examples'),
      output: 'csv',
      outputPath: csvPath,
      probe: false,
      models: ['gpt4o'],
      threshold: 70,
      ci: false,
      ignoreRobots: false,
      depth: 1,
      rate: 1,
    })
  );

  await captureConsole(() =>
    runAudit({
      file: fixturePath('examples', 'sample.md'),
      output: 'html',
      outputPath: htmlPath,
      probe: false,
      models: ['gpt4o'],
      threshold: 70,
      ci: false,
      ignoreRobots: false,
      depth: 1,
      rate: 1,
    })
  );

  assert.equal(fs.existsSync(jsonPath), true);
  assert.equal(fs.existsSync(csvPath), true);
  assert.equal(fs.existsSync(htmlPath), true);
  assert.equal(JSON.parse(fs.readFileSync(jsonPath, 'utf-8')).audits.length, 12);
});

test('runDiff writes JSON and HTML diff reports successfully', async () => {
  const tempDir = createTempDir();
  const basePath = path.join(tempDir, 'base.json');
  const headPath = path.join(tempDir, 'head.json');
  const jsonPath = path.join(tempDir, 'diff.json');
  const htmlPath = path.join(tempDir, 'diff.html');

  fs.writeFileSync(basePath, JSON.stringify(makeReport({
    scores: {
      composite: 70,
      aeo: 72,
      geo: 68,
      band: 'needs-improvement',
      percentile: null,
    },
    audits: [makeAuditResult({ id: 'faq_schema', status: 'fail', score: 0 })],
  }), null, 2), 'utf-8');
  fs.writeFileSync(headPath, JSON.stringify(makeReport({
    scores: {
      composite: 80,
      aeo: 84,
      geo: 76,
      band: 'good',
      percentile: null,
    },
    audits: [makeAuditResult({ id: 'faq_schema', status: 'pass', score: 1 })],
  }), null, 2), 'utf-8');

  await captureConsole(() =>
    runDiff({
      baseReport: basePath,
      headReport: headPath,
      output: 'json',
      outputPath: jsonPath,
    })
  );
  await captureConsole(() =>
    runDiff({
      baseReport: basePath,
      headReport: headPath,
      output: 'html',
      outputPath: htmlPath,
    })
  );

  assert.equal(JSON.parse(fs.readFileSync(jsonPath, 'utf-8')).summary.delta, 10);
  assert.match(fs.readFileSync(htmlPath, 'utf-8'), /AI Visibility Diff Report/);
});

test('diff command fails CI when visibility regresses', async () => {
  const tempDir = createTempDir();
  const basePath = path.join(tempDir, 'base.json');
  const headPath = path.join(tempDir, 'head.json');

  fs.writeFileSync(basePath, JSON.stringify(makeReport({
    scores: {
      composite: 80,
      aeo: 82,
      geo: 78,
      band: 'good',
      percentile: null,
    },
    audits: [makeAuditResult({ id: 'faq_schema', status: 'pass', score: 1 })],
  }), null, 2), 'utf-8');
  fs.writeFileSync(headPath, JSON.stringify(makeReport({
    scores: {
      composite: 70,
      aeo: 72,
      geo: 68,
      band: 'needs-improvement',
      percentile: null,
    },
    audits: [makeAuditResult({ id: 'faq_schema', status: 'fail', score: 0 })],
  }), null, 2), 'utf-8');

  const result = await runCli([
    'diff',
    '--base-report',
    basePath,
    '--head-report',
    headPath,
    '--output',
    'json',
    '--output-path',
    path.join(tempDir, 'diff.json'),
    '--fail-on-regression',
  ]);

  assert.equal(result.code, 1);
  assert.match(result.output, /AI visibility diff gate FAILED/);
});

test('runAudit exits with code 1 when CI threshold fails', async () => {
  const result = await runCli([
    'audit',
    '--file',
    fixturePath('examples', 'sample.md'),
    '--output',
    'json',
    '--output-path',
    path.join(createTempDir(), 'ci.json'),
    '--ci',
    '--threshold',
    '100',
  ]);

  assert.equal(result.code, 1);
  assert.match(result.output, /CI check FAILED/);
});

test('runAudit compares target and competitor URL reports', async () => {
  const server = await createCompareServer();
  const tempDir = createTempDir();
  const jsonPath = path.join(tempDir, 'compare.json');

  try {
    const { logs } = await captureConsole(() =>
      runAudit({
        url: `${server.origin}/target`,
        compare: `${server.origin}/competitor`,
        output: 'json',
        outputPath: jsonPath,
        probe: false,
        models: ['gpt4o'],
        threshold: 70,
        ci: false,
        ignoreRobots: true,
        depth: 1,
        rate: 1000,
      })
    );

    const report = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    assert.equal(report.type, 'comparison');
    assert.equal(report.target.url, `${server.origin}/target`);
    assert.equal(report.competitor.url, `${server.origin}/competitor`);
    assert.equal(report.target.audits.length, 12);
    assert.equal(report.competitor.audits.length, 12);
    assert.equal(typeof report.comparison.scores.composite.delta, 'number');
    assert.ok(Array.isArray(report.comparison.audit_deltas));
    assert.equal(typeof report.comparison.leader.label, 'string');
    assert.ok(Array.isArray(report.comparison.competitor_edges));
    assert.ok(Array.isArray(report.comparison.improve_first));
    assert.match(logs.join('\n'), /answerlint Compare Summary/);
    assert.match(logs.join('\n'), /Improve first|Competitor edge/);
  } finally {
    await server.close();
  }
});

test('runAudit rejects compare mode without a target URL', async () => {
  const restoreExit = patchProcessExit();

  try {
    await captureConsole(() =>
      assert.rejects(
        () =>
          runAudit({
            file: fixturePath('examples', 'sample.html'),
            compare: 'https://competitor.example/page',
            output: 'json',
            probe: false,
            models: ['gpt4o'],
            threshold: 70,
            ci: false,
            ignoreRobots: false,
            depth: 1,
            rate: 1,
          }),
        (err) => err instanceof ExitCalledError && err.code === 3
      )
    );
  } finally {
    restoreExit();
  }
});

test('runAudit exits with code 3 for invalid config and code 2 for crawl/runtime errors', async () => {
  const tempDir = createTempDir();
  const invalidConfig = path.join(tempDir, 'bad-config.json');
  fs.writeFileSync(invalidConfig, '{not-json', 'utf-8');

  const invalidConfigResult = await runCli([
    'audit',
    '--file',
    fixturePath('examples', 'sample.html'),
    '--output',
    'json',
    '--config',
    invalidConfig,
  ]);
  assert.equal(invalidConfigResult.code, 3);
  assert.match(invalidConfigResult.output, /Invalid configuration/);

  const crawlErrorResult = await runCli([
    'audit',
    '--url',
    'http://127.0.0.1:9/unreachable',
    '--output',
    'json',
  ]);
  assert.equal(crawlErrorResult.code, 2);
  assert.match(crawlErrorResult.output, /Crawl error|Unexpected error/);
});

test('CLI entrypoint handles overview and missing-input validation', async () => {
  const overview = await runCli(['overview']);
  assert.equal(overview.code, 0);
  assert.match(overview.output, /capability dashboard/);

  const missing = await runCli(['audit']);
  assert.equal(missing.code, 3);
  assert.match(missing.output, /Provide at least one input/);

  const missingDiff = await runCli(['diff']);
  assert.equal(missingDiff.code, 3);
  assert.match(missingDiff.output, /Provide both --base-report and --head-report/);
});

async function runCli(args: string[]): Promise<{ code: number; output: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [fixturePath('.test-dist', 'cli', 'index.js'), ...args],
      { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code: code ?? 0, output });
    });
  });
}

async function createCompareServer(): Promise<{
  origin: string;
  close: () => Promise<void>;
}> {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');

    if (req.url === '/target') {
      res.end(readFixture('examples', 'sample.html'));
      return;
    }

    if (req.url === '/competitor') {
      res.end(`
        <!doctype html>
        <html>
          <head><title>Thin competitor page</title></head>
          <body><p>Thin page with limited evidence.</p></body>
        </html>
      `);
      return;
    }

    res.statusCode = 404;
    res.end('');
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
