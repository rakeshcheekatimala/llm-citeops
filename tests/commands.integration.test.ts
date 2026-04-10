import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { runAudit } from '../.test-dist/cli/commands/audit.js';
import { runOverview } from '../.test-dist/cli/commands/overview.js';
import { captureConsole, createTempDir, fixturePath } from './helpers.ts';

test('overview command prints the capability dashboard', async () => {
  const { logs } = await captureConsole(() => runOverview('1.2.3'));
  const output = logs.join('\n');
  assert.match(output, /llm-citeops/);
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
