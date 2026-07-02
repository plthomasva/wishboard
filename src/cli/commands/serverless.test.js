import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deployServerless, destroyServerless } from './serverless.js';
import * as commandUtils from '../commandUtils.js';
import fs from 'node:fs';

vi.mock('../commandUtils.js', () => ({
  hasCommand: vi.fn(),
  execCommand: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => ''),
  },
}));

// Default execCommand behaviour: succeed, returning stack outputs for describe-stacks.
function defaultExec(cmd, args = []) {
  const has = (s) => args.some((a) => String(a).includes(s));
  if (cmd === 'aws' && has('get-caller-identity')) {
    return { status: 0, stdout: '123456789012\n', stderr: '' };
  }
  if (cmd === 'aws' && has('describe-stacks')) {
    if (has('FrontendBucketName')) return { status: 0, stdout: 'frontend-bucket\n', stderr: '' };
    if (has('CloudFrontDistributionId')) return { status: 0, stdout: 'DIST123\n', stderr: '' };
    if (has('CloudFrontUrl')) return { status: 0, stdout: 'https://cf.example\n', stderr: '' };
    if (has('CustomDomainUrl')) return { status: 0, stdout: 'None\n', stderr: '' };
    if (has('ImagesBucketName')) return { status: 0, stdout: 'images-bucket\n', stderr: '' };
    if (has('StackStatus')) return { status: 0, stdout: 'CREATE_COMPLETE\n', stderr: '' };
  }
  if (cmd === 'aws' && has('describe-stack-resource')) {
    return { status: 0, stdout: 'api-fn-physical\n', stderr: '' };
  }
  if (cmd === 'aws' && has('get-function-configuration')) {
    return { status: 0, stdout: JSON.stringify({ Environment: { Variables: {} } }), stderr: '' };
  }
  return { status: 0, stdout: '', stderr: '' };
}

describe('serverless commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(commandUtils.hasCommand).mockReturnValue(true);
    vi.mocked(commandUtils.execCommand).mockImplementation(defaultExec);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('');
  });

  afterEach(() => {
    delete process.env.CI;
  });

  describe('deployServerless', () => {
    it('throws if the AWS CLI is missing', () => {
      vi.mocked(commandUtils.hasCommand).mockImplementation((cmd) => cmd !== 'aws');
      expect(() => deployServerless({ stackName: 'wishboard-serverless-dev' })).toThrow(
        'aws missing'
      );
    });

    it('rejects parameter override values containing unsafe characters', () => {
      process.env.DOMAIN_NAME = 'evil.com; rm -rf /';
      try {
        expect(() =>
          deployServerless({ mode: 'dev', stackName: 'wishboard-serverless-dev', dryRun: true })
        ).toThrow(/Invalid value for DomainName/);
      } finally {
        delete process.env.DOMAIN_NAME;
      }
    });

    it('throws if AWS authentication fails', () => {
      vi.mocked(commandUtils.execCommand).mockImplementation((cmd, args) => {
        if (cmd === 'aws' && args.includes('get-caller-identity')) {
          return { status: 1, stdout: '', stderr: 'no creds' };
        }
        return { status: 0, stdout: '', stderr: '' };
      });
      expect(() => deployServerless({ stackName: 'wishboard-serverless-dev' })).toThrow(
        'Unable to authenticate to AWS'
      );
    });

    it('runs the full pipeline: build, sam build, post-build, deploy, upload, invalidate', () => {
      deployServerless({ stackName: 'wishboard-serverless-dev', region: 'us-east-1', mode: 'dev' });

      expect(commandUtils.execCommand).toHaveBeenCalledWith(
        'npm',
        ['run', 'build'],
        expect.objectContaining({ dryRun: false })
      );
      expect(commandUtils.execCommand).toHaveBeenCalledWith(
        'sam',
        ['build'],
        expect.objectContaining({ dryRun: false })
      );
      expect(commandUtils.execCommand).toHaveBeenCalledWith(
        'node',
        ['post-build.js'],
        expect.objectContaining({ dryRun: false })
      );

      // sam deploy with non-guided flags + dev NodeEnv override + tags
      const deployCall = vi
        .mocked(commandUtils.execCommand)
        .mock.calls.find((c) => c[0] === 'sam' && c[1][0] === 'deploy');
      expect(deployCall).toBeDefined();
      expect(deployCall[1]).toEqual(
        expect.arrayContaining([
          'deploy',
          '--stack-name',
          'wishboard-serverless-dev',
          '--no-confirm-changeset',
          '--capabilities',
          'CAPABILITY_IAM',
          '--resolve-s3',
          '--region',
          'us-east-1',
        ])
      );
      expect(deployCall[1]).not.toContain('--guided');

      // Parameter overrides are one quoted string; empty optional params stay quoted.
      const povValue = deployCall[1][deployCall[1].indexOf('--parameter-overrides') + 1];
      expect(povValue).toContain("ProjectName='wishboard-dev'");
      expect(povValue).toContain("NodeEnv='development'");
      expect(povValue).toContain("DomainName=''");

      // frontend upload + invalidation
      const syncCall = vi
        .mocked(commandUtils.execCommand)
        .mock.calls.find((c) => c[0] === 'aws' && c[1].includes('sync'));
      expect(syncCall[1]).toEqual(expect.arrayContaining(['s3', 'sync', '--delete']));
      expect(commandUtils.execCommand).toHaveBeenCalledWith(
        'aws',
        expect.arrayContaining([
          'cloudfront',
          'create-invalidation',
          '--distribution-id',
          'DIST123',
        ]),
        expect.any(Object)
      );
    });

    it('reads stack outputs from the explicit --stack-name, not samconfig, on a non-guided deploy', () => {
      // samconfig.toml exists (non-guided) and names a different stack.
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('stack_name = "wishboard-serverless"\n');

      deployServerless({
        stackName: 'wishboard-serverless-dev',
        region: 'us-east-1',
        skipFrontendUpload: true,
      });

      const describeCalls = vi
        .mocked(commandUtils.execCommand)
        .mock.calls.filter((c) => c[0] === 'aws' && c[1].includes('describe-stacks'));
      expect(describeCalls.length).toBeGreaterThan(0);
      for (const c of describeCalls) {
        const nameArg = c[1][c[1].indexOf('--stack-name') + 1];
        expect(nameArg).toBe('wishboard-serverless-dev');
      }
    });

    it('uses --guided when no samconfig.toml exists and CI is unset', () => {
      delete process.env.CI;
      vi.mocked(fs.existsSync).mockReturnValue(false); // no samconfig.toml, no dist check issues
      // dist check only runs in non-dryRun upload; skip upload to avoid dist existsSync=false throw
      deployServerless({ stackName: 'wishboard-serverless-dev', skipFrontendUpload: true });

      const deployCall = vi
        .mocked(commandUtils.execCommand)
        .mock.calls.find((c) => c[0] === 'sam' && c[1][0] === 'deploy');
      expect(deployCall[1]).toContain('--guided');
    });

    it('with --frontend-only, skips sam build/deploy but still uploads', () => {
      deployServerless({ stackName: 'wishboard-serverless-dev', frontendOnly: true });

      expect(commandUtils.execCommand).toHaveBeenCalledWith(
        'npm',
        ['run', 'build'],
        expect.any(Object)
      );
      const samBuild = vi.mocked(commandUtils.execCommand).mock.calls.find((c) => c[0] === 'sam');
      expect(samBuild).toBeUndefined();
      // still uploads
      expect(
        vi.mocked(commandUtils.execCommand).mock.calls.some((c) => c[1].includes('sync'))
      ).toBe(true);
    });

    it('honours --dry-run by passing dryRun through to execCommand', () => {
      deployServerless({ stackName: 'wishboard-serverless-dev', dryRun: true });
      expect(commandUtils.execCommand).toHaveBeenCalledWith(
        'npm',
        ['run', 'build'],
        expect.objectContaining({ dryRun: true })
      );
    });
  });

  describe('destroyServerless', () => {
    it('refuses to delete a production stack without --force', () => {
      expect(() => destroyServerless({ stackName: 'wishboard-serverless' })).toThrow(
        'Refusing to delete production stack without --force'
      );
    });

    it('deletes a dev stack: empties buckets then runs sam delete', () => {
      destroyServerless({ stackName: 'wishboard-serverless-dev', region: 'us-east-1' });

      expect(commandUtils.execCommand).toHaveBeenCalledWith(
        'aws',
        expect.arrayContaining(['s3', 'rm', 's3://frontend-bucket', '--recursive']),
        expect.any(Object)
      );
      expect(commandUtils.execCommand).toHaveBeenCalledWith(
        'sam',
        expect.arrayContaining([
          'delete',
          '--stack-name',
          'wishboard-serverless-dev',
          '--no-prompts',
        ]),
        expect.any(Object)
      );
    });

    it('allows deleting a production stack with --force', () => {
      destroyServerless({ stackName: 'wishboard-prod', force: true });
      expect(commandUtils.execCommand).toHaveBeenCalledWith(
        'sam',
        expect.arrayContaining(['delete', '--stack-name', 'wishboard-prod']),
        expect.any(Object)
      );
    });

    it('returns early when the stack does not exist', () => {
      vi.mocked(commandUtils.execCommand).mockImplementation((cmd, args) => {
        if (cmd === 'aws' && args.includes('StackStatus')) {
          return { status: 0, stdout: 'None\n', stderr: '' };
        }
        return { status: 0, stdout: '', stderr: '' };
      });
      destroyServerless({ stackName: 'wishboard-serverless-dev' });
      expect(vi.mocked(commandUtils.execCommand).mock.calls.some((c) => c[0] === 'sam')).toBe(
        false
      );
    });
  });
});
