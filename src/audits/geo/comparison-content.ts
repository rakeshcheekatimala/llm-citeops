import { AuditResult, AuditContext } from '../../types/index.js';

const COMPARISON_PATTERNS = [
  /\bvs\.?\b/i,
  /\bversus\b/i,
  /\bcompared?\s+to\b/i,
  /\bcomparison\b/i,
  /\balternatives?\b/i,
  /\bbest\s+\w+\b/i,
  /\btop\s+\d+\b/i,
  /\bpros?\s+(and|&|vs)\s+cons?\b/i,
  /\bdifference[s]?\s+between\b/i,
  /\bwhich\s+(is\s+)?(better|best)\b/i,
];

export function auditComparisonContent(ctx: AuditContext): AuditResult {
  const $ = ctx.$;

  const headings: string[] = [];
  $('h1, h2, h3, h4').each((_, el) => {
    headings.push($(el).text().trim());
  });

  const matchedHeadings: string[] = [];
  for (const heading of headings) {
    if (COMPARISON_PATTERNS.some((p) => p.test(heading))) {
      matchedHeadings.push(heading);
    }
  }

  // Also check body text for comparison tables
  const hasTables = $('table').length > 0;
  const tableBonus = hasTables ? 1 : 0;

  const passes = matchedHeadings.length > 0 || tableBonus > 0;

  return {
    id: 'comparison_content',
    category: 'geo',
    title: 'Comparison content present',
    status: passes ? 'pass' : 'fail',
    weight: 1.0,
    score: passes ? 1 : 0,
    evidence: passes
      ? `Comparison signals detected: ${matchedHeadings.length > 0 ? `headings matching comparison patterns: "${matchedHeadings[0]}"` : ''}${hasTables ? `${matchedHeadings.length > 0 ? '; ' : ''}comparison table(s) present` : ''}.`
      : 'No comparison-oriented content found. No headings with "vs", "alternatives", "best", "compared to" patterns, and no comparison tables.',
  };
}
