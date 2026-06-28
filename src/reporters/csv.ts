import fs from 'fs';
import { ComparisonReport, Report } from '../types/index.js';

const CSV_HEADERS = [
  'url',
  'timestamp',
  'composite',
  'aeo',
  'geo',
  'band',
  'pass_count',
  'fail_count',
  'warn_count',
];

export function generateCsvReport(reports: Report[], outputPath?: string): string {
  const rows = reports.map((r) => {
    const passCount = r.audits.filter((a) => a.status === 'pass').length;
    const failCount = r.audits.filter((a) => a.status === 'fail').length;
    const warnCount = r.audits.filter((a) => a.status === 'warn').length;

    return [
      csvEscape(r.url),
      csvEscape(r.timestamp),
      r.scores.composite,
      r.scores.aeo,
      r.scores.geo,
      csvEscape(r.scores.band),
      passCount,
      failCount,
      warnCount,
    ].join(',');
  });

  const csv = [CSV_HEADERS.join(','), ...rows].join('\n');

  if (outputPath) {
    fs.writeFileSync(outputPath, csv, 'utf-8');
  }

  return csv;
}

export function generateCsvComparisonReport(
  report: ComparisonReport,
  outputPath?: string
): string {
  const headers = [
    'role',
    ...CSV_HEADERS,
    'composite_delta_vs_other',
    'aeo_delta_vs_other',
    'geo_delta_vs_other',
  ];

  const rows = [
    comparisonRow('target', report.target, report.comparison.scores.composite.delta, report.comparison.scores.aeo.delta, report.comparison.scores.geo.delta),
    comparisonRow('competitor', report.competitor, -report.comparison.scores.composite.delta, -report.comparison.scores.aeo.delta, -report.comparison.scores.geo.delta),
  ];

  const csv = [headers.join(','), ...rows].join('\n');

  if (outputPath) {
    fs.writeFileSync(outputPath, csv, 'utf-8');
  }

  return csv;
}

function comparisonRow(
  role: 'target' | 'competitor',
  report: Report,
  compositeDelta: number,
  aeoDelta: number,
  geoDelta: number
): string {
  const passCount = report.audits.filter((a) => a.status === 'pass').length;
  const failCount = report.audits.filter((a) => a.status === 'fail').length;
  const warnCount = report.audits.filter((a) => a.status === 'warn').length;

  return [
    role,
    csvEscape(report.url),
    csvEscape(report.timestamp),
    report.scores.composite,
    report.scores.aeo,
    report.scores.geo,
    csvEscape(report.scores.band),
    passCount,
    failCount,
    warnCount,
    compositeDelta,
    aeoDelta,
    geoDelta,
  ].join(',');
}

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
