import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function generateSummary(reportPath, summaryPath) {
  if (!summaryPath) {
    console.log('No summaryPath provided. Exiting.');
    return;
  }

  if (!fs.existsSync(reportPath)) {
    fs.appendFileSync(
      summaryPath,
      '## Stryker Mutation Testing\n\n❌ Stryker mutation JSON report was not found. The run might have failed.\n'
    );
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    let totalKilled = 0;
    let totalSurvived = 0;
    let totalTimeout = 0;
    let totalNoCoverage = 0;
    let totalCompileError = 0;
    let totalRuntimeError = 0;
    let totalIgnored = 0;

    const fileSummaries = [];

    for (const [filePath, fileData] of Object.entries(data.files)) {
      let killed = 0;
      let survived = 0;
      let timeout = 0;
      let noCoverage = 0;
      let compileError = 0;
      let runtimeError = 0;
      let ignored = 0;

      for (const mutant of fileData.mutants) {
        switch (mutant.status) {
          case 'Killed':
            killed++;
            break;
          case 'Survived':
            survived++;
            break;
          case 'Timeout':
            timeout++;
            break;
          case 'NoCoverage':
            noCoverage++;
            break;
          case 'CompileError':
            compileError++;
            break;
          case 'RuntimeError':
            runtimeError++;
            break;
          case 'Ignored':
            ignored++;
            break;
          default:
            survived++; // fallback
        }
      }

      totalKilled += killed;
      totalSurvived += survived;
      totalTimeout += timeout;
      totalNoCoverage += noCoverage;
      totalCompileError += compileError;
      totalRuntimeError += runtimeError;
      totalIgnored += ignored;

      const fileTotal = killed + survived + timeout + noCoverage;
      const fileScore =
        fileTotal > 0 ? (((killed + timeout) / fileTotal) * 100).toFixed(2) : '100.00';

      fileSummaries.push({
        path: filePath,
        score: fileScore,
        total: fileTotal,
        killed,
        survived,
        timeout,
        noCoverage,
        compileError,
        runtimeError,
        ignored,
      });
    }

    const grandTotal = totalKilled + totalSurvived + totalTimeout + totalNoCoverage;
    const grandScore =
      grandTotal > 0 ? (((totalKilled + totalTimeout) / grandTotal) * 100).toFixed(2) : '100.00';

    let markdown = `## Stryker Mutation Testing Summary\n\n`;
    markdown += `### 📊 Overall Mutation Score: **${grandScore}%**\n\n`;
    markdown += `| Metric | Count |\n`;
    markdown += `| --- | --- |\n`;
    markdown += `| **Total Mutants** | ${grandTotal + totalCompileError + totalRuntimeError + totalIgnored} |\n`;
    markdown += `| **Killed** | ${totalKilled} |\n`;
    markdown += `| **Survived** | ${totalSurvived} ⚠️ |\n`;
    markdown += `| **Timeout** | ${totalTimeout} |\n`;
    if (totalNoCoverage > 0) markdown += `| **No Coverage** | ${totalNoCoverage} |\n`;
    if (totalCompileError > 0) markdown += `| **Compile Errors** | ${totalCompileError} |\n`;
    if (totalRuntimeError > 0) markdown += `| **Runtime Errors** | ${totalRuntimeError} |\n`;
    if (totalIgnored > 0) markdown += `| **Ignored** | ${totalIgnored} |\n`;
    markdown += `\n`;

    markdown += `### 📂 File Breakdown\n\n`;
    markdown += `| File | Score | Total | Killed | Survived | Timeouts |\n`;
    markdown += `| --- | --- | --- | --- | --- | --- |\n`;

    // Sort files by score ascending (lowest score/highest risk first)
    fileSummaries.sort((a, b) => parseFloat(a.score) - parseFloat(b.score));

    for (const f of fileSummaries) {
      const statusEmoji =
        parseFloat(f.score) >= 80 ? '🟢' : parseFloat(f.score) >= 60 ? '🟡' : '🔴';
      markdown += `| ${statusEmoji} \`${f.path}\` | **${f.score}%** | ${f.total} | ${f.killed} | ${f.survived} | ${f.timeout} |\n`;
    }

    markdown += `\n*Detailed HTML report is available on the GitHub Pages deployment.*\n`;

    fs.appendFileSync(summaryPath, markdown);
    console.log('Successfully appended mutation summary to GITHUB_STEP_SUMMARY');
  } catch (err) {
    console.error('Failed to generate mutation summary:', err);
    fs.appendFileSync(
      summaryPath,
      `## Stryker Mutation Testing\n\n❌ Error parsing mutation JSON report: ${err.message}\n`
    );
  }
}

// Check if run directly
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const reportPath = path.resolve('reports/mutation/mutation.json');
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  generateSummary(reportPath, summaryPath);
}
