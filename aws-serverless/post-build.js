// Post-build step for the AWS SAM esbuild build.
//
// esbuild bundles the JS layer of @libsql/client just fine, but the native
// binding (@libsql/linux-x64-gnu/index.node) cannot be bundled. The bundle
// therefore performs a runtime `require("@libsql/linux-x64-gnu")`, and that
// package is marked `External` in template.yaml. SAM's esbuild build method
// does NOT copy external packages into the artifact, so without this script the
// Lambda throws "Cannot find module '@libsql/linux-x64-gnu'" at module load and
// every API call returns HTTP 500.
//
// Run this AFTER `sam build` and BEFORE `sam deploy`:
//   sam build && node aws-serverless/post-build.js && sam deploy

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

// Lambda runtime (nodejs22.x) runs on Amazon Linux 2023 (glibc, x64), so the
// linux-x64-gnu binary is the correct one to ship.
const NATIVE_PKG = '@libsql/linux-x64-gnu';

const srcPkgDir = path.join(repoRoot, 'node_modules', NATIVE_PKG);
const buildDir = path.join(__dirname, '.aws-sam', 'build');

// Both functions import src/server/db.js, so both need the native binding.
const functions = ['ApiFunction', 'WebSocketFunction'];

if (!fs.existsSync(buildDir)) {
  console.error(`Build directory not found: ${buildDir}`);
  console.error('Run `sam build` (from the aws-serverless/ directory) before this script.');
  process.exit(1);
}

if (!fs.existsSync(srcPkgDir)) {
  console.error(`Could not find ${NATIVE_PKG} in node_modules.`);
  console.error('Install it so it can be packaged into the Lambda artifact, e.g.:');
  console.error('  npm install --no-save @libsql/linux-x64-gnu');
  process.exit(1);
}

let copied = 0;
for (const fn of functions) {
  const fnDir = path.join(buildDir, fn);
  if (!fs.existsSync(fnDir)) {
    console.warn(`Skipping ${fn}: build output not found at ${fnDir}`);
    continue;
  }
  // The bundle calls createRequire(import.meta.url) from the artifact root
  // (/var/task), so the package must resolve at /var/task/node_modules/...
  const destPkgDir = path.join(fnDir, 'node_modules', NATIVE_PKG);
  fs.mkdirSync(path.dirname(destPkgDir), { recursive: true });
  fs.rmSync(destPkgDir, { recursive: true, force: true });
  fs.cpSync(srcPkgDir, destPkgDir, { recursive: true });
  console.log(`Copied ${NATIVE_PKG} -> ${path.relative(repoRoot, destPkgDir)}`);
  copied += 1;
}

if (copied === 0) {
  console.error('No function artifacts were updated. Did `sam build` succeed?');
  process.exit(1);
}

console.log(`Done. Patched ${copied} function artifact(s) with the libSQL native binary.`);
