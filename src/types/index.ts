export type ScoreBand = 'poor' | 'needs-improvement' | 'good' | 'excellent';

export type AuditCategory = 'aeo' | 'geo';

export type AuditStatus = 'pass' | 'fail' | 'warn';

export type Priority = 'high' | 'medium' | 'low';

export type OutputFormat = 'html' | 'json' | 'csv';

export interface Recommendation {
  priority: Priority;
  score_impact: number;
  instruction: string;
  code_snippet?: string;
}

export interface AuditResult {
  id: string;
  category: AuditCategory;
  title: string;
  status: AuditStatus;
  weight: number;
  score: number; // 0 or 1 (binary)
  evidence: string;
  recommendation?: Recommendation;
}

export interface AuditContext {
  url: string;
  html: string;
  text: string;
  $: ReturnType<typeof import('cheerio').load>;
}

export interface ScoreResult {
  composite: number;
  aeo: number;
  geo: number;
  band: ScoreBand;
  percentile: number | null;
}

export interface Report {
  url: string;
  timestamp: string;
  scores: ScoreResult;
  audits: AuditResult[];
  probe: {
    enabled: boolean;
    results: ProbeResult[];
  };
}

export interface ProbeResult {
  model: string;
  visibility_score: number;
  queries: QueryResult[];
}

export interface QueryResult {
  query: string;
  cited: boolean;
  evidence?: string;
}

export interface CiteopsConfig {
  audit: {
    aeo_weight: number;
    geo_weight: number;
    custom_weights: Record<string, number>;
  };
  probe: {
    enabled: boolean;
    models: string[];
    cache_ttl_days: number;
  };
  ci: {
    threshold: number;
    fail_on_drop: boolean;
  };
}

export interface AuditOptions {
  url?: string;
  file?: string;
  dir?: string;
  sitemap?: string;
  output: OutputFormat;
  outputPath?: string;
  probe: boolean;
  models: string[];
  threshold: number;
  ci: boolean;
  compare?: string;
  ignoreRobots: boolean;
  depth: number;
  rate: number;
  config?: string;
}

export interface PageContent {
  url: string;
  html: string;
  title?: string;
}

export const DEFAULT_WEIGHTS: Record<string, number> = {
  faq_schema: 1.5,
  direct_answer: 1.5,
  qa_density: 1.5,
  readability: 1.0,
  named_entities: 1.0,
  author_byline: 1.0,
  topical_depth: 1.3,
  trust_signals: 1.3,
  content_freshness: 1.2,
  external_links: 1.0,
  comparison_content: 1.0,
  citation_likelihood: 1.3,
};
