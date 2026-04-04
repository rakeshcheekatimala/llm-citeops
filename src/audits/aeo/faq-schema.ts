import { AuditResult, AuditContext } from '../../types/index.js';

export function auditFaqSchema(ctx: AuditContext): AuditResult {
  const scripts = ctx.$('script[type="application/ld+json"]');
  let found = false;
  let foundType = '';

  scripts.each((_, el) => {
    try {
      const data = JSON.parse(ctx.$(el).html() ?? '{}') as Record<string, unknown>;
      const type = data['@type'];
      if (
        type === 'FAQPage' ||
        type === 'HowTo' ||
        (Array.isArray(type) && (type.includes('FAQPage') || type.includes('HowTo')))
      ) {
        found = true;
        foundType = Array.isArray(type) ? type[0] : String(type);
      }
    } catch {
      // invalid JSON
    }
  });

  return {
    id: 'faq_schema',
    category: 'aeo',
    title: 'FAQ / HowTo schema present',
    status: found ? 'pass' : 'fail',
    weight: 1.5,
    score: found ? 1 : 0,
    evidence: found
      ? `Found JSON-LD with @type "${foundType}" in <head>.`
      : 'No <script type="application/ld+json"> with @type FAQPage or HowTo found in <head>.',
  };
}
