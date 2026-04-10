import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const lineThreshold = 90;
const coverageDir = path.join(process.cwd(), 'coverage');
const testFiles = collectTestFiles(path.join(process.cwd(), 'tests'));
const args = ['--import', 'tsx', '--test', '--experimental-test-coverage', ...testFiles];

const child = spawn(process.execPath, args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';

child.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  output += text;
  process.stdout.write(text);
});

child.stderr.on('data', (chunk) => {
  const text = chunk.toString();
  output += text;
  process.stderr.write(text);
});

child.on('close', (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }

  const coverage = parseCoverage(output);
  if (!coverage) {
    console.error('Unable to parse aggregate coverage from test output.');
    process.exit(1);
  }

  writeCoverageArtifacts(coverage);
  const { line, branch, funcs } = coverage.aggregate;

  if (line < lineThreshold) {
    console.error(
      `Coverage gate failed. Required >=${lineThreshold}% line coverage; got lines=${line}% branches=${branch}% functions=${funcs}%.`
    );
    process.exit(1);
  }

  console.log(
    `Coverage gate passed. lines=${line}% branches=${branch}% functions=${funcs}%.`
  );
  console.log(
    `Coverage reports written to ${path.join('coverage', 'report.md')}, ${path.join('coverage', 'index.html')}, and ${path.join('coverage', 'summary.json')}.`
  );
});

function collectTestFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function parseCoverage(text) {
  const start = text.indexOf('# start of coverage report');
  const end = text.indexOf('# end of coverage report');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  const section = text.slice(start, end);
  const lines = section
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith('# '));

  const fileRows = [];
  let aggregate = null;

  for (const line of lines) {
    if (
      line.includes('start of coverage report') ||
      line.includes('file | line %') ||
      /^# -+/.test(line)
    ) {
      continue;
    }

    const match = line.match(
      /^#\s+(.+?)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s*(.*)$/
    );
    if (!match) continue;

    const [, rawFile, linePct, branchPct, funcPct, uncovered] = match;
    const row = {
      file: normalizeCoveredFile(rawFile.trim()),
      line: Number(linePct),
      branch: Number(branchPct),
      funcs: Number(funcPct),
      uncovered: uncovered.trim(),
    };

    if (row.file === 'all files' || row.file === 'all…') {
      aggregate = {
        line: row.line,
        branch: row.branch,
        funcs: row.funcs,
      };
    } else {
      fileRows.push(row);
    }
  }

  if (!aggregate) {
    return null;
  }

  return {
    generatedAt: new Date().toISOString(),
    threshold: {
      line: lineThreshold,
    },
    aggregate,
    files: fileRows.sort((a, b) => a.line - b.line || a.branch - b.branch),
  };
}

function normalizeCoveredFile(file) {
  return file.replace(/^\.test-dist\//, 'src/');
}

function writeCoverageArtifacts(coverage) {
  fs.rmSync(coverageDir, { recursive: true, force: true });
  fs.mkdirSync(coverageDir, { recursive: true });

  const worstFiles = coverage.files.slice(0, 10);
  const summaryJsonPath = path.join(coverageDir, 'summary.json');
  const markdownPath = path.join(coverageDir, 'report.md');
  const htmlPath = path.join(coverageDir, 'index.html');

  fs.writeFileSync(summaryJsonPath, JSON.stringify(coverage, null, 2), 'utf-8');
  fs.writeFileSync(markdownPath, renderMarkdownReport(coverage, worstFiles), 'utf-8');
  fs.writeFileSync(htmlPath, renderHtmlReport(coverage, worstFiles), 'utf-8');
}

function renderMarkdownReport(coverage, worstFiles) {
  const status = coverage.aggregate.line >= coverage.threshold.line ? 'PASS' : 'FAIL';

  return `# Coverage Report

Generated: ${coverage.generatedAt}

## Summary

| Metric | Value |
|---|---:|
| Status | ${status} |
| Line coverage | ${coverage.aggregate.line}% |
| Branch coverage | ${coverage.aggregate.branch}% |
| Function coverage | ${coverage.aggregate.funcs}% |
| Required line threshold | ${coverage.threshold.line}% |

## Lowest-Coverage Files

| File | Line % | Branch % | Func % | Uncovered lines |
|---|---:|---:|---:|---|
${worstFiles
  .map(
    (row) =>
      `| \`${row.file}\` | ${row.line}% | ${row.branch}% | ${row.funcs}% | ${row.uncovered || '-'} |`
  )
  .join('\n')}

## Full File Summary

| File | Line % | Branch % | Func % |
|---|---:|---:|---:|
${coverage.files
  .map((row) => `| \`${row.file}\` | ${row.line}% | ${row.branch}% | ${row.funcs}% |`)
  .join('\n')}
`;
}

function renderHtmlReport(coverage, worstFiles) {
  const status = coverage.aggregate.line >= coverage.threshold.line ? 'PASS' : 'FAIL';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>llm-citeops Coverage Report</title>
  <style>
    :root {
      --bg: #f5f3ef;
      --surface: #fffdfa;
      --text: #1c1e21;
      --muted: #5e636b;
      --border: #e6ddd1;
      --accent: #1d5c63;
      --warn: #c4871d;
      --good: #2a8f5b;
      --bad: #c7512e;
      --radius: 18px;
      --shadow: 0 14px 42px rgba(0, 0, 0, 0.06);
      --font: "Avenir Next", "Segoe UI", sans-serif;
      --mono: "SFMono-Regular", Consolas, monospace;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--font);
      color: var(--text);
      background:
        radial-gradient(circle at top right, rgba(29,92,99,0.1), transparent 24%),
        radial-gradient(circle at left 20%, rgba(199,81,46,0.1), transparent 20%),
        var(--bg);
    }
    .shell {
      max-width: 1120px;
      margin: 0 auto;
      padding: 28px 18px 48px;
    }
    .hero, .panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }
    .hero {
      padding: 28px;
      margin-bottom: 20px;
    }
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: .12em;
      font-size: .78rem;
      color: var(--muted);
    }
    h1 {
      margin: 10px 0 8px;
      font-size: clamp(2rem, 3.5vw, 3rem);
      letter-spacing: -0.04em;
    }
    .meta {
      color: var(--muted);
      font-size: .95rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-top: 22px;
    }
    .card {
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px;
      background: #fff;
    }
    .label {
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: .08em;
      font-size: .72rem;
      margin-bottom: 8px;
    }
    .value {
      font-size: 2rem;
      line-height: 1;
      letter-spacing: -0.04em;
      font-weight: 700;
    }
    .status-pass { color: var(--good); }
    .status-fail { color: var(--bad); }
    .panel {
      padding: 22px;
      margin-bottom: 18px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: .92rem;
    }
    th, td {
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    th {
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: .08em;
      font-size: .72rem;
    }
    .mono {
      font-family: var(--mono);
      font-size: .84rem;
    }
    .badge {
      display: inline-block;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: .74rem;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
      background: ${status === 'PASS' ? 'rgba(42,143,91,0.12)' : 'rgba(199,81,46,0.12)'};
      color: ${status === 'PASS' ? 'var(--good)' : 'var(--bad)'};
    }
    @media (max-width: 860px) {
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 560px) {
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <div class="eyebrow">llm-citeops · Test Coverage</div>
      <h1>Coverage Report</h1>
      <div class="meta">Generated ${escapeHtml(new Date(coverage.generatedAt).toLocaleString())}</div>
      <div class="grid">
        <div class="card">
          <div class="label">Status</div>
          <div class="value ${status === 'PASS' ? 'status-pass' : 'status-fail'}">${status}</div>
        </div>
        <div class="card">
          <div class="label">Line Coverage</div>
          <div class="value">${coverage.aggregate.line}%</div>
        </div>
        <div class="card">
          <div class="label">Branch Coverage</div>
          <div class="value">${coverage.aggregate.branch}%</div>
        </div>
        <div class="card">
          <div class="label">Function Coverage</div>
          <div class="value">${coverage.aggregate.funcs}%</div>
        </div>
      </div>
      <div style="margin-top:14px;">
        <span class="badge">Line threshold ${coverage.threshold.line}%</span>
      </div>
    </section>

    <section class="panel">
      <h2>Files That Need The Most Attention</h2>
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Line %</th>
            <th>Branch %</th>
            <th>Func %</th>
            <th>Uncovered</th>
          </tr>
        </thead>
        <tbody>
          ${worstFiles
            .map(
              (row) => `<tr>
                <td class="mono">${escapeHtml(row.file)}</td>
                <td>${row.line}%</td>
                <td>${row.branch}%</td>
                <td>${row.funcs}%</td>
                <td class="mono">${escapeHtml(row.uncovered || '-')}</td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Full Coverage Summary</h2>
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Line %</th>
            <th>Branch %</th>
            <th>Func %</th>
          </tr>
        </thead>
        <tbody>
          ${coverage.files
            .map(
              (row) => `<tr>
                <td class="mono">${escapeHtml(row.file)}</td>
                <td>${row.line}%</td>
                <td>${row.branch}%</td>
                <td>${row.funcs}%</td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </section>
  </div>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
