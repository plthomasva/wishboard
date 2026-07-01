import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock commands to avoid side effects
vi.mock('./commands/oidc.js', () => ({
  setupOidc: vi.fn(),
  destroyOidc: vi.fn(),
}));

vi.mock('./commands/serverless.js', () => ({
  deployServerless: vi.fn(),
  destroyServerless: vi.fn(),
}));

describe('wishboard CLI entrypoint', () => {
  let originalArgv;
  let exitSpy;
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    originalArgv = process.argv;
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.resetModules();
    vi.restoreAllMocks();
  });

  const runCLI = async (args) => {
    process.argv = ['node', 'wishboard.js', ...args];
    await import('./wishboard.js');
  };

  it('prints help output', async () => {
    await runCLI(['--help']);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('routes to oidc setup command with options', async () => {
    const oidcModule = await import('./commands/oidc.js');
    await runCLI(['oidc', 'setup', '--org', 'my-org', '--repo', 'my-repo', '--dry-run']);
    expect(oidcModule.setupOidc).toHaveBeenCalledWith(
      expect.objectContaining({
        org: 'my-org',
        repo: 'my-repo',
        dryRun: true,
      })
    );
  });

  it('handles errors in oidc setup action', async () => {
    const oidcModule = await import('./commands/oidc.js');
    vi.mocked(oidcModule.setupOidc).mockImplementationOnce(() => {
      throw new Error('Setup Failed');
    });
    await runCLI(['oidc', 'setup']);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error during setup: Setup Failed')
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('routes to oidc destroy command with options', async () => {
    const oidcModule = await import('./commands/oidc.js');
    await runCLI(['oidc', 'destroy', '--org', 'my-org', '--repo', 'my-repo', '--dry-run']);
    expect(oidcModule.destroyOidc).toHaveBeenCalledWith(
      expect.objectContaining({
        org: 'my-org',
        repo: 'my-repo',
        dryRun: true,
      })
    );
  });

  it('handles errors in oidc destroy action', async () => {
    const oidcModule = await import('./commands/oidc.js');
    vi.mocked(oidcModule.destroyOidc).mockImplementationOnce(() => {
      throw new Error('Destroy Failed');
    });
    await runCLI(['oidc', 'destroy']);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error during destroy: Destroy Failed')
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('routes to serverless deploy command with options', async () => {
    const mod = await import('./commands/serverless.js');
    await runCLI([
      'serverless',
      'deploy',
      '--mode',
      'dev',
      '--stack-name',
      'my-stack',
      '--dry-run',
    ]);
    expect(mod.deployServerless).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'dev', stackName: 'my-stack', dryRun: true })
    );
  });

  it('routes to serverless destroy command with options', async () => {
    const mod = await import('./commands/serverless.js');
    await runCLI(['serverless', 'destroy', '--force', '--dry-run']);
    expect(mod.destroyServerless).toHaveBeenCalledWith(
      expect.objectContaining({ force: true, dryRun: true })
    );
  });

  it('handles kiosk deploy placeholder', async () => {
    await runCLI(['kiosk', 'deploy']);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('This command is not yet migrated')
    );
  });

  it('handles kiosk setup placeholder', async () => {
    await runCLI(['kiosk', 'setup']);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('This command is not yet migrated')
    );
  });

  it('handles kiosk run placeholder', async () => {
    await runCLI(['kiosk', 'run']);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('This command is not yet migrated')
    );
  });

  it('handles db reset-password placeholder', async () => {
    await runCLI(['db', 'reset-password']);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('This command is not yet migrated')
    );
  });

  it('handles build download-fonts placeholder', async () => {
    await runCLI(['build', 'download-fonts']);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('This command is not yet migrated')
    );
  });
});
