import { AuditResult, AuditContext } from '../../types/index.js';

function parseDate(val: string | undefined | null): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export function auditContentFreshness(ctx: AuditContext): AuditResult {
  const $ = ctx.$;
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Collect candidate dates
  const candidates: Array<{ label: string; value: string }> = [];

  const metaModified = $('meta[property="article:modified_time"]').attr('content');
  const metaPublished = $('meta[property="article:published_time"]').attr('content');
  const metaDate = $('meta[name="date"]').attr('content');
  const timeEl = $('time[datetime]').first().attr('datetime');

  if (metaModified) candidates.push({ label: 'article:modified_time', value: metaModified });
  if (metaPublished) candidates.push({ label: 'article:published_time', value: metaPublished });
  if (metaDate) candidates.push({ label: 'meta[name=date]', value: metaDate });
  if (timeEl) candidates.push({ label: '<time datetime>', value: timeEl });

  // Check JSON-LD
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() ?? '{}') as Record<string, string>;
      if (data['dateModified'])
        candidates.push({ label: 'JSON-LD dateModified', value: data['dateModified'] });
      if (data['datePublished'])
        candidates.push({ label: 'JSON-LD datePublished', value: data['datePublished'] });
    } catch {
      // invalid JSON
    }
  });

  if (candidates.length === 0) {
    return {
      id: 'content_freshness',
      category: 'geo',
      title: 'Content freshness (publish / modified date)',
      status: 'fail',
      weight: 1.2,
      score: 0,
      evidence:
        'No publication or modification date found. Missing: dateModified, datePublished, article:published_time, or <time datetime>.',
    };
  }

  // Find the most recent date
  let mostRecent: Date | null = null;
  let mostRecentLabel = '';

  for (const candidate of candidates) {
    const d = parseDate(candidate.value);
    if (d && (!mostRecent || d > mostRecent)) {
      mostRecent = d;
      mostRecentLabel = `${candidate.label}: ${candidate.value}`;
    }
  }

  if (!mostRecent) {
    return {
      id: 'content_freshness',
      category: 'geo',
      title: 'Content freshness (publish / modified date)',
      status: 'fail',
      weight: 1.2,
      score: 0,
      evidence: `Date fields found but could not be parsed: ${candidates.map((c) => c.value).join(', ')}`,
    };
  }

  const isFresh = mostRecent >= twelveMonthsAgo;
  const monthsOld = Math.round(
    (now.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );

  return {
    id: 'content_freshness',
    category: 'geo',
    title: 'Content freshness (publish / modified date)',
    status: isFresh ? 'pass' : 'fail',
    weight: 1.2,
    score: isFresh ? 1 : 0,
    evidence: isFresh
      ? `Content is fresh — ${mostRecentLabel} (${monthsOld} month(s) ago).`
      : `Content may be stale — ${mostRecentLabel} (${monthsOld} month(s) ago, target ≤12 months). Update the dateModified field.`,
  };
}
