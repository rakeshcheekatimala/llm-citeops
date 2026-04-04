import { AuditResult, AuditContext } from '../../types/index.js';

export function auditDirectAnswer(ctx: AuditContext): AuditResult {
  const firstParagraph = ctx.$('p').first().text().trim();

  if (!firstParagraph) {
    return {
      id: 'direct_answer',
      category: 'aeo',
      title: 'Direct answer in first paragraph',
      status: 'fail',
      weight: 1.5,
      score: 0,
      evidence: 'No <p> elements found on page.',
    };
  }

  // A direct answer: first sentence doesn't end in '?', has reasonable length, and states something
  const sentences = firstParagraph
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const hasDirectAnswer = sentences.some(
    (s) =>
      !s.endsWith('?') &&
      s.length >= 30 &&
      !/^(click|read|scroll|learn|find|see|check|welcome|this (page|article|guide|post))/i.test(s)
  );

  const snippet =
    firstParagraph.length > 150
      ? firstParagraph.slice(0, 150) + '…'
      : firstParagraph;

  return {
    id: 'direct_answer',
    category: 'aeo',
    title: 'Direct answer in first paragraph',
    status: hasDirectAnswer ? 'pass' : 'fail',
    weight: 1.5,
    score: hasDirectAnswer ? 1 : 0,
    evidence: hasDirectAnswer
      ? `First paragraph opens with a direct statement: "${snippet}"`
      : `First paragraph does not start with a direct factual answer: "${snippet}"`,
  };
}
