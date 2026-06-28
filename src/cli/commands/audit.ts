import ora from 'ora';
import chalk from 'chalk';
import path from 'path';
import {
  AuditOptions,
  AuditResult,
  CiteopsConfig,
  ComparisonReport,
  ComparisonSummary,
  PageContent,
  Report,
} from '../../types/index.js';
import { loadConfig } from '../../config/index.js';
import { crawl } from '../../crawler/index.js';
import { runAudits } from '../../audits/runner.js';
import { computeScores, bandColor, bandLabel } from '../../scoring/index.js';
import { generateRecommendations } from '../../recommendations/index.js';
import { generateHtmlReport } from '../../reporters/html.js';
import { generateJsonReport } from '../../reporters/json.js';
import { generateCsvComparisonReport, generateCsvReport } from '../../reporters/csv.js';

export async function runAudit(options: AuditOptions): Promise<void> {
  if (!validateCompareOptions(options)) return;

  const spinner = ora({ color: 'cyan' });

  try {
    // 1. Load config
    spinner.start('Loading configuration…');
    let config;
    try {
      config = loadConfig(options.config);
      spinner.succeed('Configuration loaded.');
    } catch (err) {
      spinner.fail(`Invalid configuration: ${(err as Error).message}`);
      process.exit(3);
    }

    // 2. Crawl
    spinner.start('Fetching content…');
    let pages;
    try {
      pages = await crawl(options);
      spinner.succeed(`Fetched ${pages.length} page(s).`);
    } catch (err) {
      spinner.fail(`Crawl error: ${(err as Error).message}`);
      process.exit(2);
    }

    // 3. Run audits + score + recommend for each page
    const reports = auditPages(pages, config, spinner);

    // 4. Output reports
    if (reports.length === 0) {
      console.error(chalk.red('No pages were successfully audited.'));
      process.exit(2);
    }

    const firstReport = reports[0];
    let comparisonReport: ComparisonReport | null = null;

    if (options.compare) {
      spinner.start('Fetching competitor content…');
      let competitorPages;
      try {
        competitorPages = await crawl({
          ...options,
          url: options.compare,
          file: undefined,
          dir: undefined,
          sitemap: undefined,
          compare: undefined,
        });
        spinner.succeed(`Fetched ${competitorPages.length} competitor page(s).`);
      } catch (err) {
        spinner.fail(`Competitor crawl error: ${(err as Error).message}`);
        process.exit(2);
      }

      const competitorReports = auditPages(competitorPages, config, spinner);
      const competitorReport = competitorReports[0];

      if (!competitorReport) {
        console.error(chalk.red('No competitor page was successfully audited.'));
        process.exit(2);
      }

      comparisonReport = buildComparisonReport(firstReport, competitorReport);
    }

    if (options.output === 'json') {
      const outPath = options.outputPath ?? './citeops-report.json';
      generateJsonReport(comparisonReport ?? firstReport, outPath);
      console.log(chalk.green(`\nJSON report saved to ${outPath}`));
    } else if (options.output === 'csv') {
      const outPath = options.outputPath ?? './citeops-report.csv';
      if (comparisonReport) {
        generateCsvComparisonReport(comparisonReport, outPath);
      } else {
        generateCsvReport(reports, outPath);
      }
      console.log(chalk.green(`\nCSV report saved to ${outPath}`));
    } else {
      // HTML (default)
      const outPath =
        options.outputPath ??
        `./citeops-report-${new Date().toISOString().replace(/[:.]/g, '-')}.html`;
      generateHtmlReport(comparisonReport ?? firstReport, outPath);
      console.log(chalk.green(`\nHTML report saved to ${outPath}`));
    }

    // 5. Print terminal summary
    if (comparisonReport) {
      printComparisonSummary(comparisonReport);
    } else {
      printSummary(firstReport);
    }

    // 6. CI mode
    if (options.ci) {
      const { composite } = firstReport.scores;
      const threshold = options.threshold;
      const scoreLabel = comparisonReport ? 'target composite score' : 'composite score';
      if (composite < threshold) {
        console.log(
          chalk.red(
            `\n✖ CI check FAILED: ${scoreLabel} ${composite} is below threshold ${threshold}`
          )
        );
        process.exit(1);
      } else {
        console.log(
          chalk.green(
            `\n✔ CI check PASSED: ${scoreLabel} ${composite} ≥ threshold ${threshold}`
          )
        );
        if (comparisonReport) {
          console.log(
            chalk.dim(
              'Compare mode does not change CI threshold behavior; competitor scores are informational.'
            )
          );
        }
        process.exit(0);
      }
    }
  } catch (err) {
    spinner.fail(`Unexpected error: ${(err as Error).message}`);
    if (process.env.DEBUG) console.error(err);
    process.exit(2);
  }
}

function validateCompareOptions(options: AuditOptions): boolean {
  if (!options.compare) return true;

  if (!options.url || options.file || options.dir || options.sitemap) {
    console.error(
      chalk.red(
        'Error: --compare requires exactly one target URL via --url and one competitor URL via --compare.'
      )
    );
    process.exit(3);
    return false;
  }

  try {
    new URL(options.url);
    new URL(options.compare);
  } catch {
    console.error(chalk.red('Error: --url and --compare must both be valid absolute URLs.'));
    process.exit(3);
    return false;
  }

  return true;
}

function auditPages(
  pages: PageContent[],
  config: CiteopsConfig,
  spinner: ReturnType<typeof ora>
): Report[] {
  const reports: Report[] = [];

  for (const page of pages) {
    spinner.start(`Auditing ${page.url}…`);

    const rawAudits = runAudits(page);
    const auditResults = generateRecommendations(rawAudits);
    const scores = computeScores(auditResults, config);

    const report: Report = {
      url: page.url,
      timestamp: new Date().toISOString(),
      scores,
      audits: auditResults,
      probe: { enabled: false, results: [] },
    };

    reports.push(report);
    spinner.succeed(`Audited ${page.url} — composite: ${scores.composite}`);
  }

  return reports;
}

function buildComparisonReport(target: Report, competitor: Report): ComparisonReport {
  return {
    type: 'comparison',
    timestamp: new Date().toISOString(),
    target,
    competitor,
    comparison: buildComparisonSummary(target, competitor),
  };
}

function buildComparisonSummary(target: Report, competitor: Report): ComparisonSummary {
  const audit_deltas = target.audits.map((targetAudit) => {
    const competitorAudit = findAudit(competitor.audits, targetAudit.id);
    return {
      id: targetAudit.id,
      category: targetAudit.category,
      title: targetAudit.title,
      target_status: targetAudit.status,
      competitor_status: competitorAudit.status,
      target_score: targetAudit.score,
      competitor_score: competitorAudit.score,
      delta: targetAudit.score - competitorAudit.score,
    };
  });

  return {
    scores: {
      composite: scoreDelta(target.scores.composite, competitor.scores.composite),
      aeo: scoreDelta(target.scores.aeo, competitor.scores.aeo),
      geo: scoreDelta(target.scores.geo, competitor.scores.geo),
    },
    audit_deltas,
    target_advantages: audit_deltas.filter((audit) => audit.delta > 0),
    competitor_advantages: audit_deltas.filter((audit) => audit.delta < 0),
  };
}

function findAudit(audits: AuditResult[], id: string): AuditResult {
  const audit = audits.find((candidate) => candidate.id === id);
  if (!audit) {
    throw new Error(`Competitor audit missing expected check: ${id}`);
  }
  return audit;
}

function scoreDelta(target: number, competitor: number): { target: number; competitor: number; delta: number } {
  return {
    target,
    competitor,
    delta: target - competitor,
  };
}

function printSummary(report: Report): void {
  const { scores, audits } = report;
  const color = bandColor(scores.band);
  const label = bandLabel(scores.band);

  console.log('\n' + chalk.bold('─'.repeat(60)));
  console.log(chalk.bold('  citeops Audit Summary'));
  console.log(chalk.bold('─'.repeat(60)));
  console.log(`  URL: ${chalk.cyan(report.url)}`);
  console.log(`  Composite: ${chalk.hex(color).bold(String(scores.composite))} / 100 — ${chalk.hex(color)(label)}`);
  console.log(`  AEO Score: ${chalk.blue.bold(String(scores.aeo))} / 100`);
  console.log(`  GEO Score: ${chalk.magenta.bold(String(scores.geo))} / 100`);
  console.log(chalk.bold('─'.repeat(60)));

  const passed = audits.filter((a) => a.status === 'pass');
  const failed = audits.filter((a) => a.status !== 'pass');

  if (failed.length > 0) {
    console.log(chalk.red.bold(`\n  ${failed.length} Recommendation(s):`));
    for (const audit of failed) {
      const impact = audit.recommendation?.score_impact ?? 0;
      const priority = audit.recommendation?.priority ?? 'low';
      const priorityColor =
        priority === 'high' ? chalk.red : priority === 'medium' ? chalk.yellow : chalk.blue;
      console.log(
        `  ${chalk.red('✖')} ${audit.title} ${priorityColor(`[${priority}]`)} ${chalk.green(`+${impact} pts`)}`
      );
    }
  }

  if (passed.length > 0) {
    console.log(chalk.green.bold(`\n  ${passed.length} Passed:`));
    for (const audit of passed) {
      console.log(`  ${chalk.green('✔')} ${audit.title}`);
    }
  }

  console.log(chalk.bold('\n' + '─'.repeat(60) + '\n'));
}

function printComparisonSummary(report: ComparisonReport): void {
  const { target, competitor, comparison } = report;
  const composite = comparison.scores.composite;
  const deltaColor =
    composite.delta > 0 ? chalk.green : composite.delta < 0 ? chalk.red : chalk.yellow;

  console.log('\n' + chalk.bold('─'.repeat(60)));
  console.log(chalk.bold('  citeops Compare Summary'));
  console.log(chalk.bold('─'.repeat(60)));
  console.log(`  Target:     ${chalk.cyan(target.url)}`);
  console.log(`  Competitor: ${chalk.cyan(competitor.url)}`);
  console.log(
    `  Composite:  ${chalk.bold(String(composite.target))} vs ${chalk.bold(
      String(composite.competitor)
    )} (${deltaColor(formatDelta(composite.delta))})`
  );
  console.log(
    `  AEO:        ${target.scores.aeo} vs ${competitor.scores.aeo} (${formatDelta(
      comparison.scores.aeo.delta
    )})`
  );
  console.log(
    `  GEO:        ${target.scores.geo} vs ${competitor.scores.geo} (${formatDelta(
      comparison.scores.geo.delta
    )})`
  );

  if (comparison.target_advantages.length > 0) {
    console.log(chalk.green.bold(`\n  Target advantages (${comparison.target_advantages.length}):`));
    for (const audit of comparison.target_advantages.slice(0, 5)) {
      console.log(`  ${chalk.green('✔')} ${audit.title}`);
    }
  }

  if (comparison.competitor_advantages.length > 0) {
    console.log(
      chalk.red.bold(`\n  Competitor advantages (${comparison.competitor_advantages.length}):`)
    );
    for (const audit of comparison.competitor_advantages.slice(0, 5)) {
      console.log(`  ${chalk.red('✖')} ${audit.title}`);
    }
  }

  console.log(chalk.dim('\n  CI threshold checks use the target composite score only.'));
  console.log(chalk.bold('\n' + '─'.repeat(60) + '\n'));
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

export function resolveOutputPath(
  outputPath: string | undefined,
  format: string
): string {
  if (outputPath) return path.resolve(outputPath);
  const ext = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'html';
  return path.resolve(`./citeops-report.${ext}`);
}
