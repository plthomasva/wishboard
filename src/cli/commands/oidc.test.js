import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupOidc, destroyOidc } from './oidc.js';
import * as commandUtils from '../commandUtils.js';

vi.mock('../commandUtils.js', () => ({
  hasCommand: vi.fn(),
  getGitRepoInfo: vi.fn(),
  execCommand: vi.fn()
}));

describe('oidc commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('setupOidc', () => {
    it('throws error if AWS CLI is missing', () => {
      vi.mocked(commandUtils.hasCommand).mockImplementation((cmd) => cmd !== 'aws');

      expect(() => setupOidc({ org: 'test-org', repo: 'test-repo', region: 'us-west-2' }))
        .toThrow('AWS CLI missing');
    });

    it('throws error if AWS authentication fails', () => {
      vi.mocked(commandUtils.hasCommand).mockReturnValue(true);
      vi.mocked(commandUtils.execCommand).mockImplementation((cmd, args) => {
        if (cmd === 'aws' && args.includes('get-caller-identity')) {
          return { status: 1, stdout: '', stderr: 'Auth error' };
        }
        return { status: 0, stdout: '', stderr: '' };
      });

      expect(() => setupOidc({ org: 'test-org', repo: 'test-repo' }))
        .toThrow('AWS authentication failed');
    });

    it('performs full setup with git remote auto-detection and GitHub CLI configured', () => {
      vi.mocked(commandUtils.hasCommand).mockReturnValue(true); // aws and gh exist
      vi.mocked(commandUtils.getGitRepoInfo).mockReturnValue({ org: 'detected-org', repo: 'detected-repo' });
      vi.mocked(commandUtils.execCommand).mockImplementation((cmd, args) => {
        if (cmd === 'aws') {
          if (args.includes('get-caller-identity')) {
            return { status: 0, stdout: '123456789012\n', stderr: '' };
          }
          if (args.includes('describe-stack-resource')) {
            return { status: 0, stdout: 'None\n', stderr: '' };
          }
          if (args.includes('list-open-id-connect-providers')) {
            return { status: 0, stdout: 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com\n', stderr: '' };
          }
          if (args.includes('describe-stacks')) {
            return { status: 0, stdout: 'arn:aws:iam::123456789012:role/detected-repo-github-oidc-role\n', stderr: '' };
          }
        }
        if (cmd === 'gh' && args.includes('status')) {
          return { status: 0, stdout: 'Logged in', stderr: '' };
        }
        return { status: 0, stdout: '', stderr: '' };
      });

      setupOidc({ region: 'us-west-2' });

      // Verifies it detected repository from git remote
      expect(commandUtils.getGitRepoInfo).toHaveBeenCalled();

      // Verifies CloudFormation deploy command was executed with the external OIDC Provider ARN
      expect(commandUtils.execCommand).toHaveBeenCalledWith('aws', [
        'cloudformation', 'deploy',
        '--template-file', 'aws-serverless/github-oidc-role.yaml',
        '--stack-name', 'detected-repo-github-oidc-setup',
        '--parameter-overrides',
        'GitHubOrg=detected-org',
        'GitHubRepo=detected-repo',
        'OidcProviderArn=arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com',
        '--capabilities', 'CAPABILITY_NAMED_IAM',
        '--region', 'us-west-2'
      ], { dryRun: false });

      // Verifies GitHub secrets were registered
      expect(commandUtils.execCommand).toHaveBeenCalledWith('gh', [
        'secret', 'set', 'AWS_ROLE_TO_ASSUME',
        '--body', 'arn:aws:iam::123456789012:role/detected-repo-github-oidc-role'
      ], { dryRun: false });
    });

    it('falls back to printing manual instructions when GitHub CLI is missing', () => {
      vi.mocked(commandUtils.hasCommand).mockImplementation((cmd) => cmd !== 'gh');
      vi.mocked(commandUtils.getGitRepoInfo).mockReturnValue(null);
      vi.mocked(commandUtils.execCommand).mockImplementation((cmd, args) => {
        if (cmd === 'aws') {
          if (args.includes('get-caller-identity')) {
            return { status: 0, stdout: '123456789012\n', stderr: '' };
          }
          if (args.includes('describe-stack-resource')) {
            return { status: 0, stdout: 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com\n', stderr: '' };
          }
          if (args.includes('describe-stacks')) {
            return { status: 0, stdout: 'arn:aws:iam::123456789012:role/manual-role\n', stderr: '' };
          }
        }
        return { status: 0, stdout: '', stderr: '' };
      });

      const consoleSpy = vi.spyOn(console, 'log');

      setupOidc({ org: 'manual-org', repo: 'manual-repo', region: 'us-east-1' });

      // Should check if StackResourceDetail GithubOidcProvider is managed by stack
      expect(commandUtils.execCommand).toHaveBeenCalledWith('aws', [
        'cloudformation', 'describe-stack-resource',
        '--stack-name', 'manual-repo-github-oidc-setup',
        '--logical-resource-id', 'GithubOidcProvider',
        '--query', 'StackResourceDetail.PhysicalResourceId',
        '--output', 'text'
      ], { stdio: 'pipe' });

      // Should check for gh presence
      expect(commandUtils.hasCommand).toHaveBeenCalledWith('gh');

      // Verify it logs manual setup details
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Please manually set the following in your GitHub Repository settings'));
    });
  });

  describe('destroyOidc', () => {
    it('deletes the cloudformation stack and deletes GitHub CLI secrets if gh is authenticated', () => {
      vi.mocked(commandUtils.hasCommand).mockReturnValue(true);
      vi.mocked(commandUtils.getGitRepoInfo).mockReturnValue(null);
      vi.mocked(commandUtils.execCommand).mockImplementation((cmd, args) => {
        if (cmd === 'gh' && args.includes('status')) {
          return { status: 0, stdout: 'Logged in', stderr: '' };
        }
        return { status: 0, stdout: '', stderr: '' };
      });

      destroyOidc({ org: 'myorg', repo: 'myrepo', region: 'eu-west-1' });

      // Check aws stack delete call
      expect(commandUtils.execCommand).toHaveBeenCalledWith('aws', [
        'cloudformation', 'delete-stack',
        '--stack-name', 'myrepo-github-oidc-setup',
        '--region', 'eu-west-1'
      ], { dryRun: false });

      expect(commandUtils.execCommand).toHaveBeenCalledWith('aws', [
        'cloudformation', 'wait', 'stack-delete-complete',
        '--stack-name', 'myrepo-github-oidc-setup',
        '--region', 'eu-west-1'
      ]);

      // Check gh secret/variable deletions
      expect(commandUtils.execCommand).toHaveBeenCalledWith('gh', [
        'secret', 'delete', 'AWS_ROLE_TO_ASSUME'
      ], { dryRun: false, stdio: 'ignore' });

      expect(commandUtils.execCommand).toHaveBeenCalledWith('gh', [
        'variable', 'delete', 'AWS_REGION'
      ], { dryRun: false, stdio: 'ignore' });
    });
  });
});
