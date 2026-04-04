import { AuditResult, CiteopsConfig, ScoreBand, ScoreResult } from '../types/index.js';
import { getWeight } from '../config/index.js';

export function computeScores(
  audits: AuditResult[],
  config: CiteopsConfig
): ScoreResult {
  const aeoAudits = audits.filter((a) => a.category === 'aeo');
  const geoAudits = audits.filter((a) => a.category === 'geo');

  const aeoScore = weightedAvg(aeoAudits, config) * 100;
  const geoScore = weightedAvg(geoAudits, config) * 100;

  const composite =
    aeoScore * config.audit.aeo_weight + geoScore * config.audit.geo_weight;

  const rounded = {
    aeo: Math.round(aeoScore),
    geo: Math.round(geoScore),
    composite: Math.round(composite),
  };

  return {
    ...rounded,
    band: scoreBand(rounded.composite),
    percentile: null,
  };
}

function weightedAvg(audits: AuditResult[], config: CiteopsConfig): number {
  if (audits.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const audit of audits) {
    const weight = getWeight(config, audit.id);
    weightedSum += audit.score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

function scoreBand(score: number): ScoreBand {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 50) return 'needs-improvement';
  return 'poor';
}

export function bandColor(band: ScoreBand): string {
  switch (band) {
    case 'excellent':
      return '#0cce6b';
    case 'good':
      return '#0cce6b';
    case 'needs-improvement':
      return '#ffa400';
    case 'poor':
      return '#ff4e42';
  }
}

export function bandLabel(band: ScoreBand): string {
  switch (band) {
    case 'excellent':
      return 'Excellent';
    case 'good':
      return 'Good';
    case 'needs-improvement':
      return 'Needs Improvement';
    case 'poor':
      return 'Poor';
  }
}
