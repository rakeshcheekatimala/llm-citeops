import { AuditResult, AuditContext } from '../../types/index.js';

export function auditExternalLinks(ctx: AuditContext): AuditResult {
  const $ = ctx.$;

  let domain = '';
  try {
    domain = new URL(ctx.url).hostname;
  } catch {
    // local file — any absolute URL is external
  }

  const allExternalLinks: Array<{ href: string; text: string; nofollow: boolean }> = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const rel = $(el).attr('rel') ?? '';
    const text = $(el).text().trim();

    if (!href.startsWith('http')) return;

    let linkDomain = '';
    try {
      linkDomain = new URL(href).hostname;
    } catch {
      return;
    }

    if (domain && linkDomain === domain) return;

    const nofollow = rel.includes('nofollow');
    allExternalLinks.push({ href, text, nofollow });
  });

  const followLinks = allExternalLinks.filter((l) => !l.nofollow);
  const passes = followLinks.length >= 2;

  const examples = followLinks
    .slice(0, 3)
    .map((l) => `${l.text || l.href} (${l.href})`)
    .join(', ');

  const nofollowCount = allExternalLinks.length - followLinks.length;

  return {
    id: 'external_links',
    category: 'geo',
    title: 'External citation / link quality',
    status: passes ? 'pass' : 'fail',
    weight: 1.0,
    score: passes ? 1 : 0,
    evidence: passes
      ? `${followLinks.length} non-nofollow external link(s) found${nofollowCount > 0 ? ` (+${nofollowCount} nofollow)` : ''}. Examples: ${examples}`
      : `Only ${followLinks.length} qualifying external link(s) found (target ≥2)${nofollowCount > 0 ? `, ${nofollowCount} are nofollow` : ''}. Add authoritative external citations to improve trust signals.`,
  };
}
