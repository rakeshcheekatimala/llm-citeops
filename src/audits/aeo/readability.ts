import { AuditResult, AuditContext } from '../../types/index.js';

function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned.length === 0) return 0;
  if (cleaned.length <= 3) return 1;

  const vowelGroups = cleaned.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').match(/[aeiouy]{1,2}/g);
  return Math.max(1, vowelGroups?.length ?? 1);
}

export function auditReadability(ctx: AuditContext): AuditResult {
  const text = ctx.text.replace(/\s+/g, ' ').trim();
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 3);

  const words = text.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));

  if (sentences.length < 3 || words.length < 30) {
    return {
      id: 'readability',
      category: 'aeo',
      title: 'Readability grade ≤ 10',
      status: 'warn',
      weight: 1.0,
      score: 0,
      evidence: 'Not enough content to calculate readability grade.',
    };
  }

  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllableCount / words.length;

  // Flesch-Kincaid Grade Level
  const grade =
    0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
  const roundedGrade = Math.round(grade * 10) / 10;
  const passes = roundedGrade <= 10;

  // Find the longest sentences as evidence of complexity
  const complexSentences = sentences
    .filter((s) => s.split(/\s+/).length > 25)
    .slice(0, 2)
    .map((s) => (s.length > 120 ? s.slice(0, 120) + '…' : s));

  return {
    id: 'readability',
    category: 'aeo',
    title: 'Readability grade ≤ 10',
    status: passes ? 'pass' : 'fail',
    weight: 1.0,
    score: passes ? 1 : 0,
    evidence: passes
      ? `Flesch-Kincaid grade level: ${roundedGrade} (target ≤10). Avg ${avgWordsPerSentence.toFixed(1)} words/sentence.`
      : `Flesch-Kincaid grade level: ${roundedGrade} (target ≤10). ${complexSentences.length > 0 ? `Complex sentences detected: "${complexSentences[0]}"` : `Avg ${avgWordsPerSentence.toFixed(1)} words/sentence — simplify long sentences.`}`,
  };
}
