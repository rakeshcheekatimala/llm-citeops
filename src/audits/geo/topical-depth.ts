import { AuditResult, AuditContext } from '../../types/index.js';

function computeTfIdf(text: string): Map<string, number> {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that',
    'these', 'those', 'it', 'its', 'they', 'their', 'we', 'our', 'you',
    'your', 'he', 'she', 'his', 'her', 'as', 'if', 'so', 'not', 'no',
    'also', 'more', 'than', 'then', 'when', 'where', 'how', 'what', 'which',
    'who', 'all', 'any', 'each', 'some', 'one', 'two', 'three', 'about',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  // Sort by frequency, return top terms
  return new Map(
    [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
  );
}

export function auditTopicalDepth(ctx: AuditContext): AuditResult {
  const tfidf = computeTfIdf(ctx.text);
  const topTerms = [...tfidf.keys()].slice(0, 10);

  if (topTerms.length < 3) {
    return {
      id: 'topical_depth',
      category: 'geo',
      title: 'Topical depth score (subtopic coverage)',
      status: 'fail',
      weight: 1.3,
      score: 0,
      evidence: 'Not enough content to compute topical depth.',
    };
  }

  // Check how many top TF-IDF terms appear in headings
  const headings = ctx.$('h1, h2, h3, h4').map((_, el) => ctx.$(el).text().toLowerCase()).get();
  const headingText = headings.join(' ');

  const coveredTerms = topTerms.filter((term) => headingText.includes(term));
  const coverageRatio = coveredTerms.length / topTerms.length;
  const passes = coverageRatio >= 0.6;

  const uncoveredTerms = topTerms.filter((t) => !coveredTerms.includes(t));

  return {
    id: 'topical_depth',
    category: 'geo',
    title: 'Topical depth score (subtopic coverage)',
    status: passes ? 'pass' : 'fail',
    weight: 1.3,
    score: passes ? 1 : 0,
    evidence: passes
      ? `${coveredTerms.length}/${topTerms.length} top TF-IDF terms covered in headings (${Math.round(coverageRatio * 100)}%). Top terms: ${topTerms.slice(0, 5).join(', ')}.`
      : `Only ${coveredTerms.length}/${topTerms.length} key terms appear in headings (${Math.round(coverageRatio * 100)}% — target ≥60%). Missing topics: ${uncoveredTerms.slice(0, 5).join(', ')}.`,
  };
}
