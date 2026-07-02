#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupOidc, destroyOidc } from './commands/oidc.js';
import { deployServerless, destroyServerless } from './commands/serverless.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
);

const program = new Command();

program
  .name('wishboard')
  .description('Unified deployment and administration CLI for Wishboard')
  .version(packageJson.version);

// 1. OIDC Command Group
const oidc = program
  .command('oidc')
  .description('Manage GitHub Actions OIDC authentication with AWS');

oidc
  .command('setup')
  .description('Setup GitHub Actions OIDC Role and register repository secrets')
  .option('--org <name>', 'GitHub organization or username')
  .option('--repo <name>', 'GitHub repository name')
  .option('--region <name>', 'AWS region', 'us-east-1')
  .option('--dry-run', 'Preview the commands without executing them')
  .action((options) => {
    try {
      setupOidc(options);
    } catch (err) {
      console.error(`\x1b[31mError during setup: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  });

oidc
  .command('destroy')
  .description('Destroy GitHub Actions OIDC Stack and remove repository secrets')
  .option('--org <name>', 'GitHub organization or username')
  .option('--repo <name>', 'GitHub repository name')
  .option('--region <name>', 'AWS region', 'us-east-1')
  .option('--dry-run', 'Preview the commands without executing them')
  .action((options) => {
    try {
      destroyOidc(options);
    } catch (err) {
      console.error(`\x1b[31mError during destroy: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  });

// Serverless Command Group
const serverless = program
  .command('serverless')
  .description('Manage AWS serverless stack deployments');

serverless
  .command('deploy')
  .description(
    'Build and deploy Wishboard to AWS Serverless (Lambda + API Gateway + S3 + CloudFront)'
  )
  .option(
    '--profile <name>',
    'Named AWS CLI profile (falls back to samconfig.toml, then default credentials)'
  )
  .option('--stack-name <name>', 'CloudFormation stack name (falls back to samconfig.toml)')
  .option('--region <name>', 'AWS region (falls back to samconfig.toml, then AWS config)')
  .option('--mode <mode>', 'Deployment mode: prod or dev', 'prod')
  .option('--guided', 'Force interactive sam deploy --guided (first-time setup)')
  .option('--frontend-only', 'Rebuild and upload only the frontend; skip the backend build/deploy')
  .option(
    '--skip-frontend-upload',
    'Deploy the backend only; skip the S3 upload and CloudFront invalidation'
  )
  .option('--dry-run', 'Preview the commands without executing them')
  .action((options) => {
    try {
      deployServerless(options);
    } catch (err) {
      console.error(`\x1b[31mError during deploy: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  });

serverless
  .command('destroy')
  .description('Empty stack buckets and tear down the Wishboard AWS Serverless stack')
  .option('--profile <name>', 'Named AWS CLI profile (falls back to samconfig.toml)')
  .option('--stack-name <name>', 'CloudFormation stack name (falls back to samconfig.toml)')
  .option('--region <name>', 'AWS region (falls back to samconfig.toml)')
  .option('--force', 'Required to delete a non-dev (production) stack')
  .option('--dry-run', 'Preview the commands without executing them')
  .action((options) => {
    try {
      destroyServerless(options);
    } catch (err) {
      console.error(`\x1b[31mError during destroy: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  });

const kiosk = program
  .command('kiosk')
  .description('Manage kiosk deployments and setup (Not yet ported - use scripts/*)');

kiosk
  .command('deploy')
  .description('Deploy container stack to remote kiosk (Legacy script: scripts/deploy-kiosk.*)')
  .action(() => {
    console.log('\n\x1b[33mThis command is not yet migrated to the unified CLI.\x1b[0m');
    console.log('Please run the legacy script instead:');
    console.log(String.raw`  Windows:    .\scripts\deploy-kiosk.ps1`);
    console.log('  Linux/Mac:  ./scripts/deploy-kiosk.sh\n');
  });

kiosk
  .command('setup')
  .description(
    'Configure system properties on target Raspberry Pi (Legacy script: scripts/setup-kiosk.sh)'
  )
  .action(() => {
    console.log('\n\x1b[33mThis command is not yet migrated to the unified CLI.\x1b[0m');
    console.log('Please run the legacy script instead:');
    console.log('  Linux/Mac:  ./scripts/setup-kiosk.sh\n');
  });

kiosk
  .command('run')
  .description(
    'Run docker-compose and display settings locally on target Pi (Legacy script: scripts/build-kiosk.sh)'
  )
  .action(() => {
    console.log('\n\x1b[33mThis command is not yet migrated to the unified CLI.\x1b[0m');
    console.log('Please run the legacy script instead:');
    console.log('  Linux/Mac:  ./scripts/build-kiosk.sh\n');
  });

const dbGroup = program
  .command('db')
  .description('Manage wishboard databases (Not yet ported - use scripts/*)');

dbGroup
  .command('reset-password')
  .description('Reset user passphrase in the database (Legacy script: scripts/reset-password.js)')
  .action(() => {
    console.log('\n\x1b[33mThis command is not yet migrated to the unified CLI.\x1b[0m');
    console.log('Please run the legacy script instead:');
    console.log('  node scripts/reset-password.js <username> [new_passphrase]\n');
  });

const buildGroup = program
  .command('build')
  .description('Manage wishboard build tasks (Not yet ported - use scripts/*)');

buildGroup
  .command('download-fonts')
  .description(
    'Download fallback fonts for offline execution (Legacy script: scripts/download-fonts.js)'
  )
  .action(() => {
    console.log('\n\x1b[33mThis command is not yet migrated to the unified CLI.\x1b[0m');
    console.log('Please run the legacy script instead:');
    console.log('  node scripts/download-fonts.js\n');
  });

program.parse(process.argv);
