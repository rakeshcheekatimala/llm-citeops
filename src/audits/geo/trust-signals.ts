import { AuditResult, AuditContext } from '../../types/index.js';

export function auditTrustSignals(ctx: AuditContext): AuditResult {
  const $ = ctx.$;
  const signals: string[] = [];
  const missing: string[] = [];

  // Check author
  const hasAuthor =
    $('[rel="author"]').length > 0 ||
    $('[itemprop="author"]').length > 0 ||
    $('meta[name="author"]').length > 0;
  hasAuthor ? signals.push('author') : missing.push('author');

  // Check organization / publisher in JSON-LD
  let hasOrg = false;
  let hasPublisher = false;
  let hasCitation = false;
  let hasAbout = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $('script[type="application/ld+json"]').each((_idx: number, el: any) => {
    try {
      const data = JSON.parse($(el).html() ?? '{}') as Record<string, unknown>;
      if (data['publisher'] || data['sourceOrganization']) hasPublisher = true;
      if (data['citation']) hasCitation = true;
      if (data['about']) hasAbout = true;
      if (data['@type'] === 'Organization') hasOrg = true;
      if (typeof data['author'] === 'object') {
        const authorType = (data['author'] as Record<string, string>)['@type'];
        if (authorType === 'Person' || authorType === 'Organization') {
          hasOrg = true;
        }
      }
    } catch {
      // invalid JSON
    }
  });

  hasPublisher ? signals.push('publisher/organization') : missing.push('publisher');
  hasCitation ? signals.push('citations') : missing.push('citation schema');
  hasAbout ? signals.push('about/topic schema') : null;

  // Check for external source links
  const domain = (() => {
    try {
      return new URL(ctx.url).hostname;
    } catch {
      return '';
    }
  })();
  const externalLinks = $('a[href]').filter((_, el) => {
    const href = $(el).attr('href') ?? '';
    return href.startsWith('http') && !href.includes(domain);
  });
  const hasSources = externalLinks.length >= 2;
  hasSources ? signals.push(`${externalLinks.length} external sources`) : missing.push('external source links');

  // Check for last modified / published date
  const hasDate =
    $('meta[property="article:published_time"]').length > 0 ||
    $('meta[property="article:modified_time"]').length > 0 ||
    $('time[datetime]').length > 0;
  hasDate ? signals.push('publication date') : missing.push('publication date');

  const signalCount = signals.length;
  const passes = signalCount >= 3;

  return {
    id: 'trust_signals',
    category: 'geo',
    title: 'Trust signals (EEAT) — author, org, sources',
    status: passes ? 'pass' : 'fail',
    weight: 1.3,
    score: passes ? 1 : 0,
    evidence: passes
      ? `${signalCount} EEAT signals present: ${signals.join(', ')}.`
      : `Only ${signalCount} EEAT signal(s) found: ${signals.length > 0 ? signals.join(', ') : 'none'}. Missing: ${missing.join(', ')}.`,
  };
}
