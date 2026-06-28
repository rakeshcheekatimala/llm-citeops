import fs from 'fs';
import { ReportOutput } from '../types/index.js';

export function generateJsonReport(report: ReportOutput, outputPath?: string): string {
  const json = JSON.stringify(report, null, 2);

  if (outputPath) {
    fs.writeFileSync(outputPath, json, 'utf-8');
  }

  return json;
}
