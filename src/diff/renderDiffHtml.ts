import { DiffFinding, DiffReport, ScoreDiff } from './types.js';

export function renderDiffHtml(report: DiffReport): string {
  const scoreRows = Object.entries(report.scoreDiffs)
    .map(([, diff]) => renderScoreRow(diff))
    .join('\n');
  const improvements = renderFindingList(report.improvements, 'No improvements detected.');
  const regressions = renderFindingList(report.regressions, 'No regressions detected.');
  const recommendations = report.recommendations
    .slice(0, 8)
    .map((recommendation) => `<li>${escapeHtml(recommendation.instruction)}</li>`)
    .join('\n');
  const changedSignals = report.changedSignals
    .map(
      (signal) => `
        <tr>
          <td>${escapeHtml(signal.title)}</td>
          <td>${escapeHtml(signal.category.toUpperCase())}</td>
          <td>${escapeHtml(signal.baseStatus ?? 'unknown')}</td>
          <td>${escapeHtml(signal.headStatus ?? 'unknown')}</td>
          <td class="${statusClass(signal.status)}">${formatDelta(signal.delta)}</td>
          <td>${escapeHtml(signal.severity)}</td>
        </tr>`
    )
    .join('\n');
  const ciReasons = report.ci.reasons
    .map((reason) => `<li>${escapeHtml(reason)}</li>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Visibility Diff Report</title>
  <style>
    :root {
      --bg: #f7f8fa;
      --surface: #fff;
      --border: #dfe3e8;
      --text: #17202a;
      --muted: #5d6978;
      --good: #127a3d;
      --bad: #b42318;
      --neutral: #6b7280;
      --accent: #205493;
      --shadow: 0 1px 2px rgba(16, 24, 40, .08);
      --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--font);
      color: var(--text);
      background: var(--bg);
      line-height: 1.5;
    }
    header {
      background: #111827;
      color: #fff;
      padding: 32px 24px;
    }
    .wrap { max-width: 1120px; margin: 0 auto; }
    h1, h2 { margin: 0; letter-spacing: 0; }
    h1 { font-size: 2rem; }
    h2 { font-size: 1.1rem; margin-bottom: 16px; }
    .summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
      margin-top: 24px;
    }
    .summary-box {
      border: 1px solid rgba(255, 255, 255, .2);
      border-radius: 8px;
      padding: 16px;
      min-height: 96px;
    }
    .label {
      color: rgba(255, 255, 255, .7);
      font-size: .78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .summary-value {
      display: block;
      margin-top: 8px;
      font-size: 1.8rem;
      font-weight: 800;
    }
    main { padding: 28px 24px 40px; }
    section {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: var(--shadow);
      padding: 24px;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      overflow-wrap: anywhere;
    }
    th, td {
      padding: 12px 10px;
      border-bottom: 1px solid var(--border);
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-size: .78rem;
      text-transform: uppercase;
      letter-spacing: .06em;
    }
    tr:last-child td { border-bottom: 0; }
    ul { margin: 0; padding-left: 20px; }
    li + li { margin-top: 10px; }
    .status {
      display: inline-block;
      border-radius: 999px;
      padding: 3px 10px;
      font-size: .78rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .status-improved { color: var(--good); background: #e8f5ec; }
    .status-regressed { color: var(--bad); background: #fdecea; }
    .status-neutral { color: var(--neutral); background: #eef0f3; }
    .delta-improved { color: var(--good); font-weight: 700; }
    .delta-regressed { color: var(--bad); font-weight: 700; }
    .delta-neutral { color: var(--neutral); font-weight: 700; }
    .meta {
      margin-top: 8px;
      color: var(--muted);
      font-size: .9rem;
      overflow-wrap: anywhere;
    }
    @media (max-width: 760px) {
      .summary { grid-template-columns: 1fr; }
      table { display: block; overflow-x: auto; }
    }
  </style>
</head>
<body>
  <header>
    <div class="wrap">
      <h1>AI Visibility Diff Report</h1>
      <p class="meta">Baseline: ${escapeHtml(report.base.url)} · Current: ${escapeHtml(report.head.url)}</p>
      <div class="summary">
        <div class="summary-box">
          <span class="label">Status</span>
          <span class="summary-value"><span class="status ${statusClass(report.summary.status)}">${escapeHtml(report.summary.status)}</span></span>
        </div>
        <div class="summary-box">
          <span class="label">Composite Score</span>
          <span class="summary-value">${report.summary.baseScore} &rarr; ${report.summary.headScore} (${formatDelta(report.summary.delta)})</span>
        </div>
        <div class="summary-box">
          <span class="label">CI Status</span>
          <span class="summary-value"><span class="status ${report.ci.passed ? 'status-improved' : 'status-regressed'}">${report.ci.passed ? 'Passed' : 'Failed'}</span></span>
        </div>
      </div>
    </div>
  </header>
  <main>
    <div class="wrap">
      <section>
        <h2>Score Comparison</h2>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Baseline</th>
              <th>Current</th>
              <th>Change</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${scoreRows}
          </tbody>
        </table>
      </section>
      <section>
        <h2>Improvements</h2>
        ${improvements}
      </section>
      <section>
        <h2>Regressions</h2>
        ${regressions}
      </section>
      <section>
        <h2>Top Recommended Fixes</h2>
        ${recommendations ? `<ul>${recommendations}</ul>` : '<p>No recommendations for the current report.</p>'}
      </section>
      <section>
        <h2>Changed Signals</h2>
        ${
          changedSignals
            ? `<table>
          <thead>
            <tr>
              <th>Signal</th>
              <th>Category</th>
              <th>Baseline</th>
              <th>Current</th>
              <th>Change</th>
              <th>Severity</th>
            </tr>
          </thead>
          <tbody>${changedSignals}</tbody>
        </table>`
            : '<p>No changed signals detected.</p>'
        }
      </section>
      <section>
        <h2>CI Gate</h2>
        ${
          report.ci.passed
            ? '<p>Passed. No configured regression gate failed.</p>'
            : `<p>Failed for the following reason(s):</p><ul>${ciReasons}</ul>`
        }
      </section>
    </div>
  </main>
  <script type="application/json" id="citeops-diff-data">${escapeHtml(
    JSON.stringify(report)
  )}</script>
</body>
</html>`;
}

function renderScoreRow(diff: ScoreDiff): string {
  return `
    <tr>
      <td>${escapeHtml(diff.label)}</td>
      <td>${diff.base}</td>
      <td>${diff.head}</td>
      <td class="${statusClass(diff.status).replace('status-', 'delta-')}">${formatDelta(diff.delta)}</td>
      <td><span class="status ${statusClass(diff.status)}">${escapeHtml(diff.status)}</span></td>
    </tr>`;
}

function renderFindingList(findings: DiffFinding[], emptyText: string): string {
  if (findings.length === 0) return `<p>${emptyText}</p>`;

  return `<ul>${findings
    .map(
      (finding) =>
        `<li><strong>${escapeHtml(finding.area)}</strong> (${escapeHtml(
          finding.severity
        )}): ${escapeHtml(finding.message)}</li>`
    )
    .join('\n')}</ul>`;
}

function statusClass(status: string): string {
  if (status === 'improved') return 'status-improved';
  if (status === 'regressed') return 'status-regressed';
  return 'status-neutral';
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
