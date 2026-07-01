#!/usr/bin/env node

import '../polyfills/node-web.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Command } from 'commander';
import { runAudit } from './commands/audit.js';
import { runDiff } from './commands/diff.js';
import { runOverview } from './commands/overview.js';
import { DiffOutputFormat } from '../diff/types.js';
import { AuditOptions, OutputFormat } from '../types/index.js';

function readVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    return JSON.parse(readFileSync(pkgPath, 'utf8')).version as string;
  } catch {
    return '1.0.0';
  }
}

const program = new Command();
const version = readVersion();

program
  .name('llm-citeops')
  .description(
    'Lighthouse-inspired CLI tool that audits web content for AEO and GEO scores'
  )
  .version(version);

program
  .command('overview')
  .description(
    'Print a terminal capability dashboard (inputs, outputs, CI codes, tips)'
  )
  .alias('info')
  .action(() => {
    runOverview(version);
  });

program
  .command('audit')
  .description('Audit a URL, local file, directory, or sitemap')
  // Input sources
  .option('--url <url>', 'Audit a single URL')
  .option('--file <path>', 'Audit a local .md or .html file')
  .option('--dir <path>', 'Audit a directory of local files')
  .option('--sitemap <url>', 'Audit all URLs in a sitemap.xml')
  // Output
  .option('--output <format>', 'Report format: html | json | csv (default: html)', 'html')
  .option('--output-path <path>', 'Save report to a specific path')
  // LLM probe (Phase 2, stubbed)
  .option('--probe', 'Enable LLM probe mode (Phase 2)', false)
  .option('--models <list>', 'Comma-separated model list for probe', (v) => v.split(','), ['gpt4o', 'claude'])
  // CI mode
  .option('--threshold <n>', 'Minimum composite score for CI pass', (v) => parseInt(v, 10), 70)
  .option('--ci', 'Exit with code 1 if score is below threshold', false)
  // Crawl options
  .option('--ignore-robots', 'Ignore robots.txt restrictions', false)
  .option('--depth <n>', 'Crawl depth (default: 1)', (v) => parseInt(v, 10), 1)
  .option('--rate <n>', 'Requests per second (default: 1)', (v) => parseFloat(v), 1)
  // Config
  .option('--config <path>', 'Path to custom .citeops.json config file')
  // Comparison
  .option('--compare <url>', 'Compare a target URL against a competitor URL')
  .action(async (opts: Record<string, unknown>) => {
    const options: AuditOptions = {
      url: opts.url as string | undefined,
      file: opts.file as string | undefined,
      dir: opts.dir as string | undefined,
      sitemap: opts.sitemap as string | undefined,
      output: (opts.output as OutputFormat) ?? 'html',
      outputPath: opts.outputPath as string | undefined,
      probe: Boolean(opts.probe),
      models: Array.isArray(opts.models) ? (opts.models as string[]) : ['gpt4o', 'claude'],
      threshold: typeof opts.threshold === 'number' ? opts.threshold : 70,
      ci: Boolean(opts.ci),
      compare: opts.compare as string | undefined,
      ignoreRobots: Boolean(opts.ignoreRobots),
      depth: typeof opts.depth === 'number' ? opts.depth : 1,
      rate: typeof opts.rate === 'number' ? opts.rate : 1,
      config: opts.config as string | undefined,
    };

    if (!options.url && !options.file && !options.dir && !options.sitemap) {
      console.error(
        'Error: Provide at least one input with --url, --file, --dir, or --sitemap'
      );
      process.exit(3);
    }

    if (options.compare && (!options.url || options.file || options.dir || options.sitemap)) {
      console.error(
        'Error: --compare requires exactly one target URL via --url and one competitor URL via --compare.'
      );
      process.exit(3);
    }

    await runAudit(options);
  });

program
  .command('diff')
  .description('Compare AI visibility between two JSON audit reports')
  .option('--base-report <path>', 'Baseline JSON audit report')
  .option('--head-report <path>', 'Current or pull request JSON audit report')
  .option('--output <format>', 'Report format: html | json (default: html)', 'html')
  .option('--output-path <path>', 'Save diff report to a specific path')
  .option('--fail-on-regression', 'Exit with code 1 when a configured visibility regression is detected', false)
  .option('--fail-on-high-severity', 'Exit with code 1 when a high-severity signal regresses', false)
  .option('--max-composite-drop <n>', 'Allowed composite score drop before CI fails', (v) => parseInt(v, 10))
  .option('--max-aeo-drop <n>', 'Allowed AEO score drop before CI fails', (v) => parseInt(v, 10))
  .option('--max-geo-drop <n>', 'Allowed GEO score drop before CI fails', (v) => parseInt(v, 10))
  .option('--max-citation-readiness-drop <n>', 'Allowed citation readiness drop before CI fails', (v) => parseInt(v, 10))
  .option('--min-composite-delta <n>', 'Minimum required composite score delta', (v) => parseInt(v, 10))
  .option('--min-aeo-delta <n>', 'Minimum required AEO score delta', (v) => parseInt(v, 10))
  .option('--min-geo-delta <n>', 'Minimum required GEO score delta', (v) => parseInt(v, 10))
  .option('--min-citation-readiness-delta <n>', 'Minimum required citation readiness delta', (v) => parseInt(v, 10))
  .action(async (opts: Record<string, unknown>) => {
    const output = (opts.output as DiffOutputFormat) ?? 'html';

    if (!opts.baseReport || !opts.headReport) {
      console.error('Error: Provide both --base-report and --head-report');
      process.exit(3);
    }

    if (output !== 'html' && output !== 'json') {
      console.error('Error: --output must be html or json');
      process.exit(3);
    }

    await runDiff({
      baseReport: opts.baseReport as string,
      headReport: opts.headReport as string,
      output,
      outputPath: opts.outputPath as string | undefined,
      failOnRegression: Boolean(opts.failOnRegression),
      failOnHighSeverity: Boolean(opts.failOnHighSeverity),
      maxCompositeDrop: opts.maxCompositeDrop as number | undefined,
      maxAeoDrop: opts.maxAeoDrop as number | undefined,
      maxGeoDrop: opts.maxGeoDrop as number | undefined,
      maxCitationReadinessDrop: opts.maxCitationReadinessDrop as number | undefined,
      minCompositeDelta: opts.minCompositeDelta as number | undefined,
      minAeoDelta: opts.minAeoDelta as number | undefined,
      minGeoDelta: opts.minGeoDelta as number | undefined,
      minCitationReadinessDelta: opts.minCitationReadinessDelta as number | undefined,
    });
  });

program.parse(process.argv);
