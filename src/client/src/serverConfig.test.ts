import { afterEach, describe, expect, it } from 'vitest';
import { getServerConfig } from './serverConfig';

describe('getServerConfig', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__WISHBOARD_CONFIG__;
  });

  it('returns an empty object when no config has been loaded', () => {
    delete (globalThis as Record<string, unknown>).__WISHBOARD_CONFIG__;
    expect(getServerConfig()).toEqual({});
  });

  it('returns the boot-time config stashed on globalThis', () => {
    (globalThis as Record<string, unknown>).__WISHBOARD_CONFIG__ = {
      realtimeProvider: 'apigateway',
      domain: 'demo.wishboards.app',
      apIp: '10.42.0.1:3000',
    };
    expect(getServerConfig()).toEqual({
      realtimeProvider: 'apigateway',
      domain: 'demo.wishboards.app',
      apIp: '10.42.0.1:3000',
    });
  });
});
