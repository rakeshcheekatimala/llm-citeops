import { DiffStatus } from './types.js';

export function classifyDelta(delta: number): DiffStatus {
  if (delta > 0) return 'improved';
  if (delta < 0) return 'regressed';
  return 'neutral';
}
