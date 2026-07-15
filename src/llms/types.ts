export interface LlmsGenerateOptions {
  dir?: string;
  url?: string;
  sitemap?: string;
  site?: string;
  siteName?: string;
  summary?: string;
  outDir: string;
  full: boolean;
  maxLinks: number;
  maxFullChars: number;
}

export interface LlmsLintOptions {
  file: string;
  strict: boolean;
  ci: boolean;
  maxChars: number;
}

export type LlmsIssueSeverity = 'error' | 'warn';

export interface LlmsIssue {
  severity: LlmsIssueSeverity;
  message: string;
  line?: number;
}

export interface LlmsLintResult {
  valid: boolean;
  issues: LlmsIssue[];
  errorCount: number;
  warningCount: number;
}

export interface LlmsSourcePage {
  sourcePath?: string;
  url: string;
  raw: string;
  html?: string;
}

export interface LlmsPage {
  url: string;
  title: string;
  description: string;
  section: string;
  text: string;
  sourcePath?: string;
}

export interface LlmsDocument {
  siteName: string;
  summary: string;
  details: string;
  pages: LlmsPage[];
}
