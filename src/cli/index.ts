#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join } from 'path';
import { Command } from 'commander';
import { runAudit } from './commands/audit.js';
import { runOverview } from './commands/overview.js';
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
  // Comparison (Phase 3, stubbed)
  .option('--compare <url>', 'Compare against a competitor URL (Phase 3)')
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

    await runAudit(options);
  });

program.parse(process.argv);
