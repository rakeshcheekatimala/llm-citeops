import chalk from 'chalk';
import path from 'path';
import { generateDiffReport } from '../../diff/generateDiffReport.js';
import { DiffOptions } from '../../diff/types.js';
import { generateDiffHtmlReport } from '../../reporters/diffHtmlReporter.js';
import { generateDiffJsonReport } from '../../reporters/diffJsonReporter.js';

export async function runDiff(options: DiffOptions): Promise<void> {
  try {
    const report = generateDiffReport(options.baseReport, options.headReport, {
      failOnRegression: options.failOnRegression,
      failOnHighSeverity: options.failOnHighSeverity,
      maxCompositeDrop: options.maxCompositeDrop,
      maxAeoDrop: options.maxAeoDrop,
      maxGeoDrop: options.maxGeoDrop,
      maxCitationReadinessDrop: options.maxCitationReadinessDrop,
      minCompositeDelta: options.minCompositeDelta,
      minAeoDelta: options.minAeoDelta,
      minGeoDelta: options.minGeoDelta,
      minCitationReadinessDelta: options.minCitationReadinessDelta,
    });
    const outputPath = resolveDiffOutputPath(options.outputPath, options.output);

    if (options.output === 'json') {
      generateDiffJsonReport(report, outputPath);
      console.log(chalk.green(`\nJSON diff report saved to ${outputPath}`));
    } else {
      generateDiffHtmlReport(report, outputPath);
      console.log(chalk.green(`\nHTML diff report saved to ${outputPath}`));
    }

    printDiffSummary(report);

    if (!report.ci.passed) {
      console.log(chalk.red('\nAI visibility diff gate FAILED.'));
      for (const reason of report.ci.reasons) {
        console.log(chalk.red(`  - ${reason}`));
      }
      process.exit(1);
    }
  } catch (err) {
    console.error(chalk.red(`Diff error: ${(err as Error).message}`));
    process.exit(3);
  }
}

export function resolveDiffOutputPath(
  outputPath: string | undefined,
  format: string
): string {
  if (outputPath) return path.resolve(outputPath);
  return path.resolve(`./citeops-diff-report.${format === 'html' ? 'html' : 'json'}`);
}

function printDiffSummary(report: ReturnType<typeof generateDiffReport>): void {
  const summaryColor =
    report.summary.status === 'improved'
      ? chalk.green
      : report.summary.status === 'regressed'
        ? chalk.red
        : chalk.gray;

  console.log('\n' + chalk.bold('─'.repeat(60)));
  console.log(chalk.bold('  citeops AI Visibility Diff'));
  console.log(chalk.bold('─'.repeat(60)));
  console.log(`  Baseline: ${chalk.cyan(report.base.url)}`);
  console.log(`  Current:  ${chalk.cyan(report.head.url)}`);
  console.log(
    `  Composite: ${report.summary.baseScore} → ${report.summary.headScore} ${summaryColor(
      `(${formatDelta(report.summary.delta)})`
    )}`
  );

  for (const key of ['aeo', 'geo', 'citationReadiness']) {
    const diff = report.scoreDiffs[key];
    if (!diff) continue;
    const color = diff.status === 'improved' ? chalk.green : diff.status === 'regressed' ? chalk.red : chalk.gray;
    console.log(
      `  ${diff.label}: ${diff.base} → ${diff.head} ${color(`(${formatDelta(diff.delta)})`)}`
    );
  }

  const ciColor = report.ci.passed ? chalk.green : chalk.red;
  console.log(`  CI Gate: ${ciColor(report.ci.passed ? 'passed' : 'failed')}`);
  console.log(chalk.bold('─'.repeat(60) + '\n'));
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}
