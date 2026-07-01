import fs from 'fs';
import { DiffReport } from '../diff/types.js';

export function generateDiffJsonReport(report: DiffReport, outputPath?: string): string {
  const json = JSON.stringify(report, null, 2);

  if (outputPath) {
    fs.writeFileSync(outputPath, json, 'utf-8');
  }

  return json;
}
