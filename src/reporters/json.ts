import fs from 'fs';
import { Report } from '../types/index.js';

export function generateJsonReport(report: Report, outputPath?: string): string {
  const json = JSON.stringify(report, null, 2);

  if (outputPath) {
    fs.writeFileSync(outputPath, json, 'utf-8');
  }

  return json;
}
