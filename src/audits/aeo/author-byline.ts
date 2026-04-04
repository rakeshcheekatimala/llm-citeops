import { AuditResult, AuditContext } from '../../types/index.js';

export function auditAuthorByline(ctx: AuditContext): AuditResult {
  const $ = ctx.$;

  // Check HTML attributes
  const htmlAuthor =
    $('[rel="author"]').length > 0 ||
    $('[itemprop="author"]').length > 0 ||
    $('[class*="author"]').length > 0 ||
    $('[id*="author"]').length > 0;

  // Check JSON-LD for author / Person
  let jsonLdAuthor = false;
  let authorName = '';

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() ?? '{}') as Record<string, unknown>;
      if (data['author']) {
        jsonLdAuthor = true;
        const author = data['author'] as Record<string, string> | string;
        if (typeof author === 'object' && author['name']) {
          authorName = author['name'];
        } else if (typeof author === 'string') {
          authorName = author;
        }
      }
    } catch {
      // invalid JSON
    }
  });

  // Check meta tags
  const metaAuthor = $('meta[name="author"]').attr('content') ?? '';

  const found = htmlAuthor || jsonLdAuthor || metaAuthor.length > 0;
  const evidence = found
    ? [
        htmlAuthor ? 'HTML author attribute detected' : '',
        jsonLdAuthor ? `JSON-LD author: "${authorName || 'present'}"` : '',
        metaAuthor ? `<meta name="author" content="${metaAuthor}">` : '',
      ]
        .filter(Boolean)
        .join('; ')
    : 'No author byline found. Missing: rel="author", itemprop="author", JSON-LD author field, or <meta name="author">.';

  return {
    id: 'author_byline',
    category: 'aeo',
    title: 'Author byline + credentials present',
    status: found ? 'pass' : 'fail',
    weight: 1.0,
    score: found ? 1 : 0,
    evidence,
  };
}
