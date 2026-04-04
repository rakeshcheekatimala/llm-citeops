import { AuditResult, AuditContext } from '../../types/index.js';

export function auditCitationLikelihood(ctx: AuditContext): AuditResult {
  const $ = ctx.$;

  // This is a composite heuristic that combines multiple signals
  const signals: string[] = [];
  const missing: string[] = [];

  // 1. Has structured schema (any JSON-LD)
  const hasSchema = $('script[type="application/ld+json"]').length > 0;
  hasSchema ? signals.push('structured schema') : missing.push('JSON-LD schema');

  // 2. Has author byline
  const hasAuthor =
    $('[rel="author"]').length > 0 ||
    $('[itemprop="author"]').length > 0 ||
    $('meta[name="author"]').length > 0;
  hasAuthor ? signals.push('author byline') : missing.push('author byline');

  // 3. Has FAQ schema
  let hasFaq = false;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() ?? '{}') as Record<string, unknown>;
      if (data['@type'] === 'FAQPage' || data['@type'] === 'HowTo') {
        hasFaq = true;
      }
    } catch {
      // invalid JSON
    }
  });
  hasFaq ? signals.push('FAQ/HowTo schema') : missing.push('FAQ/HowTo schema');

  // 4. Has external links (≥3)
  let domain = '';
  try {
    domain = new URL(ctx.url).hostname;
  } catch {
    // local file
  }
  const externalLinks = $('a[href]').filter((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (!href.startsWith('http')) return false;
    try {
      return new URL(href).hostname !== domain;
    } catch {
      return false;
    }
  }).length;
  const hasCitations = externalLinks >= 3;
  hasCitations
    ? signals.push(`${externalLinks} external citations`)
    : missing.push(`≥3 external citations (found ${externalLinks})`);

  // 5. Has headings with H2/H3
  const hasStructure = $('h2, h3').length >= 3;
  hasStructure
    ? signals.push('well-structured headings')
    : missing.push('structured headings (H2/H3 ≥3)');

  const signalScore = signals.length;
  const passes = signalScore >= 3;

  return {
    id: 'citation_likelihood',
    category: 'geo',
    title: 'Citation likelihood signals',
    status: passes ? 'pass' : 'fail',
    weight: 1.3,
    score: passes ? 1 : 0,
    evidence: passes
      ? `${signalScore}/5 citation likelihood signals present: ${signals.join(', ')}.`
      : `Only ${signalScore}/5 citation signals present${signals.length > 0 ? `: ${signals.join(', ')}` : ''}. Missing: ${missing.join('; ')}.`,
  };
}
