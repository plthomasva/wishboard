#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupOidc, destroyOidc } from './commands/oidc.js';
import { deployServerless, destroyServerless } from './commands/serverless.js';
import { deployKiosk, setupKiosk, runKiosk } from './commands/kiosk.js';
import { generateAuthToken } from './commands/auth.js';

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

const kiosk = program.command('kiosk').description('Deploy and manage the Raspberry Pi kiosk');

kiosk
  .command('deploy')
  .description('Deploy the container stack to a remote Raspberry Pi over SSH')
  .option('--user <name>', 'SSH user on the Pi', 'pi')
  .option('--host <name>', 'Pi hostname or IP address', 'raspberrypi.local')
  .option('--mode <mode>', 'Deployment mode: prod, dev, or dual', 'dev')
  .option(
    '--domain <name>',
    'Public domain (used in prod mode)',
    'wishboard.painless-computing.com'
  )
  .option('--reset-rules', 'Re-seed matching rules from bundled defaults (default: keep existing)')
  .option(
    '--app-version <version>',
    'Container image tag to deploy (default: package.json version)'
  )
  .option('--dry-run', 'Preview the commands without executing them')
  .action((options) => {
    try {
      deployKiosk(options);
    } catch (err) {
      console.error(`\x1b[31mError during kiosk deploy: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  });

kiosk
  .command('setup')
  .description('Configure the local Raspberry Pi as a kiosk (runs scripts/setup-kiosk.sh)')
  .option('--mode <mode>', 'Deployment mode: prod, dev, or dual', 'prod')
  .option(
    '--domain <name>',
    'Public domain (used in prod mode)',
    'wishboard.painless-computing.com'
  )
  .option('--dry-run', 'Preview the commands without executing them')
  .action((options) => {
    try {
      setupKiosk(options);
    } catch (err) {
      console.error(`\x1b[31mError during kiosk setup: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  });

kiosk
  .command('run')
  .description('Bring up the kiosk container + display locally (runs scripts/build-kiosk.sh)')
  .option('--mode <mode>', 'Deployment mode: prod, dev, or dual', 'dev')
  .option(
    '--domain <name>',
    'Public domain (used in prod mode)',
    'wishboard.painless-computing.com'
  )
  .option('--reset-rules', 'Re-seed matching rules from bundled defaults (default: keep existing)')
  .option('--app-version <version>', 'Container image tag to run (default: package.json version)')
  .option('--dry-run', 'Preview the commands without executing them')
  .action((options) => {
    try {
      runKiosk(options);
    } catch (err) {
      console.error(`\x1b[31mError during kiosk run: ${err.message}\x1b[0m`);
      process.exit(1);
    }
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

const auth = program.command('auth').description('Manage user authentication and tokens');

auth
  .command('token <username>')
  .description('Generate a session token for a user')
  .option('--dry-run', 'Preview the action without executing it')
  .action(async (username, options) => {
    try {
      await generateAuthToken(username, options);
    } catch (err) {
      console.error(`\x1b[31mError generating token: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  });

program.parse(process.argv);
