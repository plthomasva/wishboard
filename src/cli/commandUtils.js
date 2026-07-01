import { spawnSync } from 'node:child_process';

/**
 * Checks if a command exists in the system PATH.
 * @param {string} name 
 * @returns {boolean}
 */
export function hasCommand(name) {
  try {
    const res = spawnSync(name, ['--version'], { stdio: 'ignore' });
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
    const argsString = args.map(arg => (arg.includes(' ') ? `"${arg}"` : arg)).join(' ');
    console.log(`[DRY RUN] Would execute: ${command} ${argsString}`);
    return { status: 0, stdout: '', stderr: '' };
  }
  
  // Under Windows, some commands like npm are .cmd or need shell execution.
  // But aws, gh, git can be spawned directly without shell: true.
  const result = spawnSync(command, args, { stdio, encoding: 'utf8', ...options });
  
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error(`Command not found in PATH: ${command}`);
    }
    throw result.error;
  }
  
  return {
    status: result.status ?? 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? ''
  };
}
