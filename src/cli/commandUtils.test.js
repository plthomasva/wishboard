import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { hasCommand, getGitRepoInfo, execCommand } from './commandUtils.js';

vi.mock('node:child_process', () => {
  const m = {
    spawnSync: vi.fn(),
  };
  return {
    ...m,
    default: m,
  };
});

describe('commandUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hasCommand', () => {
    it('returns true if the command exists (no ENOENT error)', () => {
      vi.mocked(spawnSync).mockReturnValue({ error: undefined });
      expect(hasCommand('some-cmd')).toBe(true);
      expect(spawnSync).toHaveBeenCalledWith('some-cmd', ['--version'], { stdio: 'ignore' });
    });

    it('returns false if the command does not exist (ENOENT error)', () => {
      vi.mocked(spawnSync).mockReturnValue({ error: { code: 'ENOENT' } });
      expect(hasCommand('missing-cmd')).toBe(false);
    });

    it('returns false if spawnSync throws an error', () => {
      vi.mocked(spawnSync).mockImplementation(() => {
        throw new Error('Spawn failed');
      });
      expect(hasCommand('err-cmd')).toBe(false);
    });
  });

  describe('getGitRepoInfo', () => {
    it('parses ssh/git remote URL correctly', () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: 'git@github.com:someorg/somerepo.git\n',
        stderr: '',
      });

      const info = getGitRepoInfo();
      expect(info).toEqual({ org: 'someorg', repo: 'somerepo' });
      expect(spawnSync).toHaveBeenCalledWith('git', ['remote', 'get-url', 'origin'], {
        encoding: 'utf8',
      });
    });

    it('parses https remote URL correctly', () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: 'https://github.com/anotherorg/anotherrepo.git\n',
        stderr: '',
      });

      const info = getGitRepoInfo();
      expect(info).toEqual({ org: 'anotherorg', repo: 'anotherrepo' });
    });

    it('returns null if command fails', () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: 1,
        stdout: '',
        stderr: 'error',
      });

      expect(getGitRepoInfo()).toBeNull();
    });
  });

  describe('execCommand', () => {
    it('executes command and returns output', () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: 'output\n',
        stderr: '',
      });

      const res = execCommand('my-command', ['arg1', 'arg2']);
      expect(res).toEqual({ status: 0, stdout: 'output\n', stderr: '' });
      expect(spawnSync).toHaveBeenCalledWith('my-command', ['arg1', 'arg2'], {
        stdio: 'inherit',
        encoding: 'utf8',
      });
    });

    it('logs command but does not execute it in dryRun mode', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const res = execCommand('my-command', ['arg1', 'arg 2'], { dryRun: true });

      expect(res).toEqual({ status: 0, stdout: '', stderr: '' });
      expect(spawnSync).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('[DRY RUN] Would execute: my-command arg1 "arg 2"');

      consoleSpy.mockRestore();
    });

    it('throws error when command is missing', () => {
      vi.mocked(spawnSync).mockReturnValue({
        error: { code: 'ENOENT' },
      });

      expect(() => execCommand('missing-cmd', [])).toThrow(
        'Command not found in PATH: missing-cmd'
      );
    });

    it('throws other errors encountered during spawn', () => {
      const customError = new Error('Permission denied');
      vi.mocked(spawnSync).mockReturnValue({
        error: customError,
      });

      expect(() => execCommand('err-cmd', [])).toThrow(customError);
    });
  });
});
