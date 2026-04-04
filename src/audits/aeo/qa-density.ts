import { AuditResult, AuditContext } from '../../types/index.js';

export function auditQaDensity(ctx: AuditContext): AuditResult {
  const text = ctx.text;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (wordCount < 50) {
    return {
      id: 'qa_density',
      category: 'aeo',
      title: 'Q&A density (questions per 500 words)',
      status: 'fail',
      weight: 1.5,
      score: 0,
      evidence: `Page has too little content (${wordCount} words) to evaluate Q&A density.`,
    };
  }

  // Count question marks — both in headings and body text
  const questionCount = (text.match(/\?/g) ?? []).length;
  const per500 = (questionCount / wordCount) * 500;
  const passes = per500 >= 2;

  return {
    id: 'qa_density',
    category: 'aeo',
    title: 'Q&A density (questions per 500 words)',
    status: passes ? 'pass' : 'fail',
    weight: 1.5,
    score: passes ? 1 : 0,
    evidence: passes
      ? `Found ${questionCount} questions across ${wordCount} words (${per500.toFixed(1)} per 500 words — target ≥2).`
      : `Only ${questionCount} question(s) in ${wordCount} words (${per500.toFixed(1)} per 500 words — target ≥2). Add question-framed headings or FAQ sections.`,
  };
}
