import { AuditResult, Report } from '../types/index.js';
import { classifyDelta } from './classifyDelta.js';
import {
  ChangedSignal,
  DiffCiResult,
  DiffFinding,
  DiffGateOptions,
  DiffReport,
  DiffSeverity,
  ScoreDiff,
} from './types.js';

type MetricDefinition = {
  key: string;
  label: string;
  scoreKey?: string;
  auditIds?: string[];
};

const METRICS: MetricDefinition[] = [
  { key: 'composite', label: 'Composite', scoreKey: 'composite' },
  { key: 'aeo', label: 'AEO', scoreKey: 'aeo' },
  { key: 'geo', label: 'GEO', scoreKey: 'geo' },
  {
    key: 'citationReadiness',
    label: 'Citation Readiness',
    scoreKey: 'citationReadiness',
    auditIds: ['citation_likelihood', 'external_links', 'trust_signals'],
  },
  {
    key: 'schemaQuality',
    label: 'Schema Quality',
    scoreKey: 'schemaQuality',
    auditIds: ['faq_schema', 'trust_signals'],
  },
  {
    key: 'contentClarity',
    label: 'Content Clarity',
    scoreKey: 'contentClarity',
    auditIds: ['direct_answer', 'readability', 'qa_density'],
  },
  {
    key: 'entityCoverage',
    label: 'Entity Coverage',
    scoreKey: 'entityCoverage',
    auditIds: ['named_entities'],
  },
  {
    key: 'evidenceQuality',
    label: 'Evidence Quality',
    scoreKey: 'evidenceQuality',
    auditIds: ['external_links', 'trust_signals'],
  },
  {
    key: 'authorDateSourceSignals',
    label: 'Author/Date/Source Signals',
    scoreKey: 'authorDateSourceSignals',
    auditIds: ['author_byline', 'content_freshness', 'trust_signals'],
  },
  {
    key: 'answerability',
    label: 'FAQ/Answerability Coverage',
    scoreKey: 'answerability',
    auditIds: ['direct_answer', 'faq_schema', 'qa_density'],
  },
  {
    key: 'aiExtractability',
    label: 'AI Extractability',
    scoreKey: 'aiExtractability',
    auditIds: ['direct_answer', 'readability', 'topical_depth', 'citation_likelihood'],
  },
];

export function compareReports(
  base: Report,
  head: Report,
  gateOptions: DiffGateOptions = {}
): DiffReport {
  const scoreDiffs = buildScoreDiffs(base, head);
  const changedSignals = buildChangedSignals(base, head);
  const improvements = changedSignals
    .filter((signal) => signal.status === 'improved')
    .map(signalToImprovement);
  const regressions = changedSignals
    .filter((signal) => signal.status === 'regressed')
    .map(signalToRegression);
  const summaryDiff = scoreDiffs.composite;
  const ci = evaluateCi(scoreDiffs, regressions, gateOptions);

  return {
    base,
    head,
    summary: {
      status: summaryDiff.status,
      baseScore: summaryDiff.base,
      headScore: summaryDiff.head,
      delta: summaryDiff.delta,
    },
    scoreDiffs,
    improvements,
    regressions,
    recommendations: collectRecommendations(head),
    changedSignals,
    ci,
    generatedAt: new Date().toISOString(),
  };
}

function buildScoreDiffs(base: Report, head: Report): Record<string, ScoreDiff> {
  const diffs: Record<string, ScoreDiff> = {};

  for (const metric of METRICS) {
    const baseScore = metricScore(base, metric);
    const headScore = metricScore(head, metric);

    if (baseScore === undefined || headScore === undefined) continue;

    const delta = headScore - baseScore;
    diffs[metric.key] = {
      label: metric.label,
      base: baseScore,
      head: headScore,
      delta,
      status: classifyDelta(delta),
    };
  }

  return diffs;
}

function metricScore(report: Report, metric: MetricDefinition): number | undefined {
  if (metric.scoreKey && hasNumericScore(report, metric.scoreKey)) {
    return getNumericScore(report, metric.scoreKey);
  }

  if (!metric.auditIds) return undefined;

  const audits = metric.auditIds
    .map((id) => report.audits.find((audit) => audit.id === id))
    .filter((audit): audit is AuditResult => Boolean(audit));

  if (audits.length === 0) return undefined;

  const weightedTotal = audits.reduce((sum, audit) => sum + audit.score * audit.weight, 0);
  const totalWeight = audits.reduce((sum, audit) => sum + audit.weight, 0);

  return totalWeight > 0 ? Math.round((weightedTotal / totalWeight) * 100) : undefined;
}

function hasNumericScore(report: Report, key: string): boolean {
  return typeof getNumericScore(report, key) === 'number';
}

function getNumericScore(report: Report, key: string): number | undefined {
  const scores = report.scores as unknown as Record<string, unknown>;
  const value = scores[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function buildChangedSignals(base: Report, head: Report): ChangedSignal[] {
  const baseById = new Map(base.audits.map((audit) => [audit.id, audit]));

  return head.audits
    .map((headAudit): ChangedSignal | undefined => {
      const baseAudit = baseById.get(headAudit.id);
      if (!baseAudit) return undefined;

      const baseScore = scoreToPercent(baseAudit.score);
      const headScore = scoreToPercent(headAudit.score);
      const delta = headScore - baseScore;

      if (delta === 0 && baseAudit.status === headAudit.status) return undefined;

      return {
        id: headAudit.id,
        title: headAudit.title,
        category: headAudit.category,
        baseStatus: baseAudit.status,
        headStatus: headAudit.status,
        baseScore,
        headScore,
        delta,
        status: classifyDelta(delta),
        severity: severityFor(headAudit, Math.abs(delta)),
      };
    })
    .filter((signal): signal is ChangedSignal => signal !== undefined);
}

function scoreToPercent(score: number): number {
  return Math.round(score * 100);
}

function severityFor(audit: AuditResult, absoluteDelta: number): DiffSeverity {
  if (audit.recommendation?.priority) return audit.recommendation.priority;
  if (audit.weight >= 1.3 || absoluteDelta >= 50) return 'high';
  if (audit.weight >= 1) return 'medium';
  return 'low';
}

function signalToImprovement(signal: ChangedSignal): DiffFinding {
  return {
    area: signal.title,
    severity: signal.severity,
    auditId: signal.id,
    delta: signal.delta,
    message: `${signal.title} improved from ${signal.baseScore} to ${signal.headScore}.`,
  };
}

function signalToRegression(signal: ChangedSignal): DiffFinding {
  return {
    area: signal.title,
    severity: signal.severity,
    auditId: signal.id,
    delta: signal.delta,
    message: `${signal.title} regressed from ${signal.baseScore} to ${signal.headScore}.`,
  };
}

function collectRecommendations(report: Report) {
  return report.audits
    .filter((audit) => audit.status !== 'pass' && audit.recommendation)
    .map((audit) => audit.recommendation!)
    .sort((a, b) => b.score_impact - a.score_impact);
}

function evaluateCi(
  scoreDiffs: Record<string, ScoreDiff>,
  regressions: DiffFinding[],
  options: DiffGateOptions
): DiffCiResult {
  const reasons: string[] = [];
  const failOnRegression = Boolean(options.failOnRegression);

  if (failOnRegression) {
    addMaxDropReason(reasons, scoreDiffs.composite, options.maxCompositeDrop ?? 0);
    addMaxDropReason(reasons, scoreDiffs.aeo, options.maxAeoDrop ?? 0);
    addMaxDropReason(reasons, scoreDiffs.geo, options.maxGeoDrop ?? 0);
    addMaxDropReason(
      reasons,
      scoreDiffs.citationReadiness,
      options.maxCitationReadinessDrop ?? 0
    );

    if (regressions.length > 0) {
      reasons.push(`${regressions.length} visibility signal regression(s) detected.`);
    }
  }

  addMinDeltaReason(reasons, scoreDiffs.composite, options.minCompositeDelta);
  addMinDeltaReason(reasons, scoreDiffs.aeo, options.minAeoDelta);
  addMinDeltaReason(reasons, scoreDiffs.geo, options.minGeoDelta);
  addMinDeltaReason(
    reasons,
    scoreDiffs.citationReadiness,
    options.minCitationReadinessDelta
  );

  if (options.failOnHighSeverity) {
    const highSeverityRegressions = regressions.filter((finding) => finding.severity === 'high');
    if (highSeverityRegressions.length > 0) {
      reasons.push(
        `${highSeverityRegressions.length} high-severity visibility regression(s) detected.`
      );
    }
  }

  return {
    passed: reasons.length === 0,
    reasons,
  };
}

function addMaxDropReason(
  reasons: string[],
  diff: ScoreDiff | undefined,
  maxDrop: number
): void {
  if (!diff) return;

  const allowedDelta = -Math.abs(maxDrop);
  if (diff.delta < allowedDelta) {
    reasons.push(
      `${diff.label} dropped by ${Math.abs(diff.delta)} point(s), exceeding the allowed ${Math.abs(
        maxDrop
      )} point drop.`
    );
  }
}

function addMinDeltaReason(
  reasons: string[],
  diff: ScoreDiff | undefined,
  minDelta: number | undefined
): void {
  if (!diff || minDelta === undefined) return;

  if (diff.delta < minDelta) {
    reasons.push(
      `${diff.label} delta ${formatDelta(diff.delta)} is below the required ${formatDelta(
        minDelta
      )}.`
    );
  }
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}
