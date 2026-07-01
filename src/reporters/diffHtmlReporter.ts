import fs from 'fs';
import { renderDiffHtml } from '../diff/renderDiffHtml.js';
import { DiffReport } from '../diff/types.js';

export function generateDiffHtmlReport(report: DiffReport, outputPath?: string): string {
  const html = renderDiffHtml(report);

  if (outputPath) {
    fs.writeFileSync(outputPath, html, 'utf-8');
  }

  return html;
}
