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

program.configureHelp({
  showGlobalOptions: true,
});

import { DEFAULT_EVENT_PROFILE } from './commandUtils.js';

program
  .name('wishboard')
  .description('Unified deployment and administration CLI for Wishboard')
  .version(packageJson.version)
  .option('--dry-run', 'Preview the action without executing it')
  .option(
    '--event-profile <name>',
    'Event profile name (e.g. lifestyle, professional)',
    DEFAULT_EVENT_PROFILE
  );

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
  .action((options, command) => {
    try {
      setupOidc(command.optsWithGlobals());
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
  .action((options, command) => {
    try {
      destroyOidc(command.optsWithGlobals());
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
  .option('--domain <name>', 'Custom domain name (e.g., wishboard.example.com)')
  .option(
    '--cert-domain <name>',
    'Custom domain name for the ACM Certificate (e.g., wishboards.app for a wildcard)'
  )
  .option(
    '--hosted-zone-id <id>',
    'Route 53 Hosted Zone ID for custom domain aliases and SSL validation'
  )
  .option('--acm-cert-arn <arn>', 'Existing ACM Certificate ARN in us-east-1')
  .option('--guided', 'Force interactive sam deploy --guided (first-time setup)')
  .option('--frontend-only', 'Rebuild and upload only the frontend; skip the backend build/deploy')
  .option(
    '--skip-frontend-upload',
    'Deploy the backend only; skip the S3 upload and CloudFront invalidation'
  )
  .action((options, command) => {
    try {
      deployServerless(command.optsWithGlobals());
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
  .action((options, command) => {
    try {
      destroyServerless(command.optsWithGlobals());
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
  .action((options, command) => {
    try {
      deployKiosk(command.optsWithGlobals());
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
  .action((options, command) => {
    try {
      setupKiosk(command.optsWithGlobals());
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
  .action((options, command) => {
    try {
      runKiosk(command.optsWithGlobals());
    } catch (err) {
      console.error(`\x1b[31mError during kiosk run: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  });

const dbGroup = program.command('db').description('Manage wishboard databases');

dbGroup
  .command('reset-password <username> [new_passphrase]')
  .description('Reset user passphrase in the database')
  .option('--url <url>', 'Remote Wishboard instance URL')
  .option('--admin <username>', 'Admin username for remote execution', 'admin')
  .action(async (username, newPassphrase, options, command) => {
    try {
      const opts = command.optsWithGlobals();
      const { resetPassword } = await import('./commands/db.js');
      const success = await resetPassword(username, newPassphrase, opts);
      if (!success) process.exit(1);
    } catch (err) {
      console.error(`\x1b[31mError resetting password: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  });

dbGroup
  .command('reset-rules')
  .description('Reset matching rules to bundled defaults (local or remote)')
  .option('--url <url>', 'Remote Wishboard instance URL (kiosk or serverless)')
  .option('--admin <username>', 'Admin username for remote execution', 'admin')
  .option('--force', 'Skip production safety prompt')
  .action(async (options, command) => {
    try {
      const opts = command.optsWithGlobals();
      const { resetRules } = await import('./commands/db.js');
      const success = await resetRules(opts);
      if (!success) process.exit(1);
    } catch (err) {
      console.error(`\x1b[31mError resetting rules: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  });

const buildGroup = program.command('build').description('Manage wishboard build tasks');

buildGroup
  .command('download-fonts')
  .description('Download fallback fonts for offline execution')
  .action(async (options, command) => {
    try {
      const opts = command.optsWithGlobals();
      const { downloadFonts } = await import('./commands/build.js');
      await downloadFonts(opts);
    } catch (err) {
      console.error(`\x1b[31mError downloading fonts: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  });

const auth = program.command('auth').description('Manage user authentication and tokens');

auth
  .command('token <username>')
  .description('Generate a session token for a user')
  .option(
    '--url <url>',
    'Base URL of the remote Wishboard instance (e.g. https://demo.wishboards.app)'
  )
  .option(
    '--passphrase <passphrase>',
    'Passphrase for remote authentication (if not provided, you will be prompted)'
  )
  .action(async (username, options, command) => {
    try {
      await generateAuthToken(username, command.optsWithGlobals());
    } catch (err) {
      console.error(`\x1b[31mError generating token: ${err.message}\x1b[0m`);
      process.exit(1);
    }
  });

await program.parseAsync(process.argv);
