import { AuditResult, Priority, Recommendation, Report } from '../types/index.js';

export type DiffStatus = 'improved' | 'regressed' | 'neutral';

export type DiffSeverity = Priority;

export type DiffOutputFormat = 'html' | 'json';

export interface ScoreDiff {
  label: string;
  base: number;
  head: number;
  delta: number;
  status: DiffStatus;
}

export interface DiffFinding {
  area: string;
  severity: DiffSeverity;
  message: string;
  auditId?: string;
  delta?: number;
}

export interface ChangedSignal {
  id: string;
  title: string;
  category: AuditResult['category'];
  baseStatus?: AuditResult['status'];
  headStatus?: AuditResult['status'];
  baseScore: number;
  headScore: number;
  delta: number;
  status: DiffStatus;
  severity: DiffSeverity;
}

export interface DiffCiResult {
  passed: boolean;
  reasons: string[];
}

export interface DiffReport {
  base: Report;
  head: Report;
  summary: {
    status: DiffStatus;
    baseScore: number;
    headScore: number;
    delta: number;
  };
  scoreDiffs: Record<string, ScoreDiff>;
  improvements: DiffFinding[];
  regressions: DiffFinding[];
  recommendations: Recommendation[];
  changedSignals: ChangedSignal[];
  ci: DiffCiResult;
  generatedAt: string;
}

export interface DiffGateOptions {
  failOnRegression?: boolean;
  failOnHighSeverity?: boolean;
  maxCompositeDrop?: number;
  maxAeoDrop?: number;
  maxGeoDrop?: number;
  maxCitationReadinessDrop?: number;
  minCompositeDelta?: number;
  minAeoDelta?: number;
  minGeoDelta?: number;
  minCitationReadinessDelta?: number;
}

export interface DiffOptions extends DiffGateOptions {
  baseReport: string;
  headReport: string;
  output: DiffOutputFormat;
  outputPath?: string;
}
