import { spawnSync } from 'node:child_process';

// npm/npx/sam are .cmd shims on Windows. Since Node's CVE-2024-27980 fix, they
// can't be spawned directly, and `shell: true` with an args array is flagged
// (DEP0190) because arguments are concatenated without escaping. Instead we
// launch them through `cmd.exe /c`, which resolves the .cmd via PATHEXT while
// letting Node apply proper Windows argument escaping.
const WINDOWS_CMD_SHIMS = ['npm', 'npx', 'sam'];

function needsCmdWrapper(command) {
  return process.platform === 'win32' && WINDOWS_CMD_SHIMS.includes(command);
}

function spawnCross(command, args, options) {
  if (needsCmdWrapper(command)) {
    return spawnSync('cmd.exe', ['/c', command, ...args], options);
  }
  return spawnSync(command, args, options);
}

/**
 * Checks if a command exists in the system PATH.
 * @param {string} name
 * @returns {boolean}
 */
export function hasCommand(name) {
  try {
    const res = spawnCross(name, ['--version'], { stdio: 'ignore' });
    // When wrapped in cmd.exe, a missing command exits non-zero rather than
    // raising ENOENT, so fall back to checking the exit status in that case.
    if (needsCmdWrapper(name)) {
      return !res.error && res.status === 0;
    }
    return res.error?.code !== 'ENOENT';
  } catch {
    return false;
  }
}

/**
 * Resolves the GitHub organization (owner) and repository name from git remote.
 * @returns {{ org: string, repo: string } | null}
 */
export function getGitRepoInfo() {
  try {
    const res = spawnSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' });
    if (res.status === 0 && res.stdout) {
      const url = res.stdout.trim();
      const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?/);
      if (match) {
        return { org: match[1], repo: match[2] };
      }
    }
  } catch {
    // Ignore and fallback
  }
  return null;
}

/**
 * Helper to run a system command cross-platform.
 * @param {string} command
 * @param {string[]} args
 * @param {object} options
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
export function execCommand(command, args, options = {}) {
  const { stdio = 'inherit', dryRun = false } = options;
  if (dryRun) {
    const argsString = args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)).join(' ');
    console.log(`[DRY RUN] Would execute: ${command} ${argsString}`);
    return { status: 0, stdout: '', stderr: '' };
  }

  const result = spawnCross(command, args, { stdio, encoding: 'utf8', ...options });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error(`Command not found in PATH: ${command}`);
    }
    throw result.error;
  }

  return {
    status: result.status ?? 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}
