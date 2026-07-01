import fs from 'fs';
import { Report } from '../types/index.js';
import { compareReports } from './compareReports.js';
import { DiffGateOptions, DiffReport } from './types.js';

export function generateDiffReport(
  baseReportPath: string,
  headReportPath: string,
  gateOptions: DiffGateOptions = {}
): DiffReport {
  const base = readAuditReport(baseReportPath, 'baseline');
  const head = readAuditReport(headReportPath, 'current');

  return compareReports(base, head, gateOptions);
}

function readAuditReport(path: string, label: string): Report {
  let parsed: unknown;

  try {
    parsed = JSON.parse(fs.readFileSync(path, 'utf-8'));
  } catch (err) {
    throw new Error(`Unable to read ${label} report at ${path}: ${(err as Error).message}`);
  }

  assertReport(parsed, label);

  return parsed;
}

function assertReport(value: unknown, label: string): asserts value is Report {
  if (!value || typeof value !== 'object') {
    throw new Error(`Invalid ${label} report: expected an object.`);
  }

  const report = value as Partial<Report>;
  if (!report.scores || typeof report.scores !== 'object') {
    throw new Error(`Invalid ${label} report: missing scores.`);
  }

  const scores = report.scores as unknown as Record<string, unknown>;
  for (const key of ['composite', 'aeo', 'geo']) {
    if (typeof scores[key] !== 'number') {
      throw new Error(`Invalid ${label} report: scores.${key} must be a number.`);
    }
  }

  if (!Array.isArray(report.audits)) {
    throw new Error(`Invalid ${label} report: audits must be an array.`);
  }

  if (typeof report.url !== 'string') {
    throw new Error(`Invalid ${label} report: url must be a string.`);
  }

  if (typeof report.timestamp !== 'string') {
    throw new Error(`Invalid ${label} report: timestamp must be a string.`);
  }
}
