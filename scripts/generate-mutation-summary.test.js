import { describe, expect, it, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { generateSummary } from './generate-mutation-summary.js';

describe('generateSummary', () => {
  const tempFiles = [];

  const getTempPath = (prefix) => {
    const tempPath = path.join(os.tmpdir(), `${prefix}-${crypto.randomUUID()}.txt`);
    tempFiles.push(tempPath);
    return tempPath;
  };

  afterEach(() => {
    for (const file of tempFiles) {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch {
          // ignore cleanup errors
        }
      }
    }
    tempFiles.length = 0;
  });

  it('exits early if no summaryPath is provided', () => {
    const reportPath = getTempPath('report');
    fs.writeFileSync(reportPath, '{}');

    // Should not throw or crash
    generateSummary(reportPath, null);
    generateSummary(reportPath, undefined);
  });

  it('writes a warning message if the report file does not exist', () => {
    const reportPath = path.join(os.tmpdir(), `non-existent-${crypto.randomUUID()}.json`);
    const summaryPath = getTempPath('summary');

    generateSummary(reportPath, summaryPath);

    const content = fs.readFileSync(summaryPath, 'utf8');
    expect(content).toContain('Stryker Mutation Testing');
    expect(content).toContain('Stryker mutation JSON report was not found');
  });

  it('writes an error message if the report contains invalid JSON', () => {
    const reportPath = getTempPath('report');
    const summaryPath = getTempPath('summary');
    fs.writeFileSync(reportPath, 'invalid-json-{');

    generateSummary(reportPath, summaryPath);

    const content = fs.readFileSync(summaryPath, 'utf8');
    expect(content).toContain('Stryker Mutation Testing');
    expect(content).toContain('Error parsing mutation JSON report');
  });

  it('parses a valid report and appends correct stats and breakdown', () => {
    const reportPath = getTempPath('report');
    const summaryPath = getTempPath('summary');

    const mockReport = {
      files: {
        'src/server/db.js': {
          mutants: [
            { id: '1', status: 'Killed' },
            { id: '2', status: 'Survived' },
            { id: '3', status: 'Timeout' },
            { id: '4', status: 'NoCoverage' },
            { id: '5', status: 'CompileError' },
            { id: '6', status: 'RuntimeError' },
            { id: '7', status: 'Ignored' },
          ],
        },
        'src/server/auth.js': {
          mutants: [
            { id: '8', status: 'Killed' },
            { id: '9', status: 'Killed' },
          ],
        },
      },
    };

    fs.writeFileSync(reportPath, JSON.stringify(mockReport));

    generateSummary(reportPath, summaryPath);

    const content = fs.readFileSync(summaryPath, 'utf8');
    expect(content).toContain('Stryker Mutation Testing Summary');
    // totalKilled = 3, totalSurvived = 1, totalTimeout = 1, totalNoCoverage = 1
    // grandTotal = 3 + 1 + 1 + 1 = 6
    // grandScore = (3 + 1) / 6 * 100 = 66.67%
    expect(content).toContain('Overall Mutation Score: **66.67%**');
    expect(content).toContain('| **Total Mutants** | 9 |');
    expect(content).toContain('| **Killed** | 3 |');
    expect(content).toContain('| **Survived** | 1 ⚠️ |');
    expect(content).toContain('| **Timeout** | 1 |');
    expect(content).toContain('| **No Coverage** | 1 |');
    expect(content).toContain('| **Compile Errors** | 1 |');
    expect(content).toContain('| **Runtime Errors** | 1 |');
    expect(content).toContain('| **Ignored** | 1 |');

    // Checks file list sorting (lowest first)
    // db.js: score = (1 + 1) / 4 = 50%
    // auth.js: score = (2 + 0) / 2 = 100%
    const lines = content.split('\n');
    const dbIndex = lines.findIndex((l) => l.includes('db.js'));
    const authIndex = lines.findIndex((l) => l.includes('auth.js'));
    expect(dbIndex).toBeGreaterThan(0);
    expect(authIndex).toBeGreaterThan(0);
    expect(dbIndex).toBeLessThan(authIndex); // db.js (50%) should appear before auth.js (100%)
  });
});
