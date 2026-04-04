import fs from 'fs';
import { Report } from '../types/index.js';

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

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
