import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { Report } from '../types/index.js';
import { bandColor, bandLabel } from '../scoring/index.js';

Handlebars.registerHelper('bandColor', (band: string) => bandColor(band as never));
Handlebars.registerHelper('bandLabel', (band: string) => bandLabel(band as never));
Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
Handlebars.registerHelper('ne', (a: unknown, b: unknown) => a !== b);
Handlebars.registerHelper('upper', (s: string) => s?.toUpperCase());
Handlebars.registerHelper('capitalize', (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
);
Handlebars.registerHelper('gaugeOffset', (score: number) => {
  // SVG circle circumference = 2πr = 2 * π * 54 ≈ 339.3
  const circumference = 339.3;
  return circumference - (score / 100) * circumference;
});
Handlebars.registerHelper('preEscape', (code: string) =>
  code
    ? code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    : ''
);
Handlebars.registerHelper('priorityClass', (priority: string) => {
  switch (priority) {
    case 'high': return 'priority-high';
    case 'medium': return 'priority-medium';
    case 'low': return 'priority-low';
    default: return '';
  }
});
Handlebars.registerHelper('sortByImpact', (audits: Report['audits']) => {
  return [...audits]
    .filter((a) => a.status !== 'pass')
    .sort((a, b) => (b.recommendation?.score_impact ?? 0) - (a.recommendation?.score_impact ?? 0));
});
Handlebars.registerHelper('passedAudits', (audits: Report['audits']) =>
  audits.filter((a) => a.status === 'pass')
);
Handlebars.registerHelper('failCount', (audits: Report['audits']) =>
  audits.filter((a) => a.status !== 'pass').length
);
Handlebars.registerHelper('passCount', (audits: Report['audits']) =>
  audits.filter((a) => a.status === 'pass').length
);

let compiledTemplate: HandlebarsTemplateDelegate | null = null;

function getTemplate(): HandlebarsTemplateDelegate {
  if (compiledTemplate) return compiledTemplate;

  // Try to load from templates directory — support both bundled (dist/) and dev (src/) layouts
  const candidates = [
    path.join(process.cwd(), 'templates/report.hbs'),
    path.join(__dirname, '../templates/report.hbs'),
    path.join(__dirname, '../../templates/report.hbs'),
    path.join(__dirname, '../../../templates/report.hbs'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const source = fs.readFileSync(candidate, 'utf-8');
      compiledTemplate = Handlebars.compile(source);
      return compiledTemplate;
    }
  }

  throw new Error(
    'HTML report template not found. Expected at templates/report.hbs'
  );
}

export function generateHtmlReport(report: Report, outputPath?: string): string {
  const template = getTemplate();

  const html = template({
    report,
    generatedAt: new Date(report.timestamp).toLocaleString(),
    scoreColor: bandColor(report.scores.band),
    bandLabel: bandLabel(report.scores.band),
  });

  if (outputPath) {
    fs.writeFileSync(outputPath, html, 'utf-8');
  }

  return html;
}
