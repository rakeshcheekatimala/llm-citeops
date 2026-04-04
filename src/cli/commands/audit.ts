import ora from 'ora';
import chalk from 'chalk';
import path from 'path';
import { AuditOptions, Report } from '../../types/index.js';
import { loadConfig } from '../../config/index.js';
import { crawl } from '../../crawler/index.js';
import { runAudits } from '../../audits/runner.js';
import { computeScores, bandColor, bandLabel } from '../../scoring/index.js';
import { generateRecommendations } from '../../recommendations/index.js';
import { generateHtmlReport } from '../../reporters/html.js';
import { generateJsonReport } from '../../reporters/json.js';
import { generateCsvReport } from '../../reporters/csv.js';

export async function runAudit(options: AuditOptions): Promise<void> {
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

    // 4. Output reports
    if (reports.length === 0) {
      console.error(chalk.red('No pages were successfully audited.'));
      process.exit(2);
    }

    const firstReport = reports[0];

    if (options.output === 'json') {
      const outPath = options.outputPath ?? './citeops-report.json';
      generateJsonReport(firstReport, outPath);
      console.log(chalk.green(`\nJSON report saved to ${outPath}`));
    } else if (options.output === 'csv') {
      const outPath = options.outputPath ?? './citeops-report.csv';
      generateCsvReport(reports, outPath);
      console.log(chalk.green(`\nCSV report saved to ${outPath}`));
    } else {
      // HTML (default)
      const outPath =
        options.outputPath ??
        `./citeops-report-${new Date().toISOString().replace(/[:.]/g, '-')}.html`;
      generateHtmlReport(firstReport, outPath);
      console.log(chalk.green(`\nHTML report saved to ${outPath}`));
    }

    // 5. Print terminal summary
    printSummary(firstReport);

    // 6. CI mode
    if (options.ci) {
      const { composite } = firstReport.scores;
      const threshold = options.threshold;
      if (composite < threshold) {
        console.log(
          chalk.red(
            `\n✖ CI check FAILED: composite score ${composite} is below threshold ${threshold}`
          )
        );
        process.exit(1);
      } else {
        console.log(
          chalk.green(
            `\n✔ CI check PASSED: composite score ${composite} ≥ threshold ${threshold}`
          )
        );
        process.exit(0);
      }
    }
  } catch (err) {
    spinner.fail(`Unexpected error: ${(err as Error).message}`);
    if (process.env.DEBUG) console.error(err);
    process.exit(2);
  }
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

export function resolveOutputPath(
  outputPath: string | undefined,
  format: string
): string {
  if (outputPath) return path.resolve(outputPath);
  const ext = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'html';
  return path.resolve(`./citeops-report.${ext}`);
}
