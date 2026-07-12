import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useExcludedWishes } from './useExcludedWishes';
import { useAuth } from '../AuthContext';

vi.mock('../AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockAuth = (overrides: { token: string | null; user: any }) =>
  vi.mocked(useAuth).mockReturnValue({
    token: overrides.token,
    user: overrides.user,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    setTokenExternally: vi.fn(),
  } as any);

describe('useExcludedWishes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    globalThis.fetch = vi.fn() as any;
  });

  it('loads exclusions from localStorage for anonymous users', async () => {
    mockAuth({ token: null, user: null });
    localStorage.setItem('wishboard.excludedWishes', JSON.stringify(['w1', 'w2']));

    const { result } = renderHook(() => useExcludedWishes());

    expect(result.current.loading).toBe(false);
    expect(result.current.excludedIds).toEqual(['w1', 'w2']);
    expect(result.current.isExcluded('w1')).toBe(true);
    expect(result.current.isExcluded('w3')).toBe(false);
  });

  it('handles corrupt localStorage gracefully', async () => {
    mockAuth({ token: null, user: null });
    localStorage.setItem('wishboard.excludedWishes', 'invalid-json');

    const { result } = renderHook(() => useExcludedWishes());

    expect(result.current.loading).toBe(false);
    expect(result.current.excludedIds).toEqual([]);
  });

  it('excludes a wish in localStorage for anonymous users', async () => {
    mockAuth({ token: null, user: null });

    const { result } = renderHook(() => useExcludedWishes());

    await act(async () => {
      await result.current.excludeWish('w1');
    });

    expect(result.current.excludedIds).toEqual(['w1']);
    expect(JSON.parse(localStorage.getItem('wishboard.excludedWishes') || '[]')).toEqual(['w1']);
  });

  it('unexcludes a wish in localStorage for anonymous users', async () => {
    mockAuth({ token: null, user: null });
    localStorage.setItem('wishboard.excludedWishes', JSON.stringify(['w1', 'w2']));

    const { result } = renderHook(() => useExcludedWishes());

    await act(async () => {
      await result.current.unexcludeWish('w1');
    });

    expect(result.current.excludedIds).toEqual(['w2']);
    expect(JSON.parse(localStorage.getItem('wishboard.excludedWishes') || '[]')).toEqual(['w2']);
  });

  it('loads exclusions from server for authenticated users', async () => {
    mockAuth({ token: 'my-token', user: { id: 'u1' } as any });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ['w1', 'w3'],
    }) as any;

    const { result } = renderHook(() => useExcludedWishes());

    // Wait for the state update in useEffect
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.excludedIds).toEqual(['w1', 'w3']);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/wishes/exclusions/list', {
      headers: {
        Authorization: 'Bearer my-token',
      },
    });
  });

  it('excludes a wish on server for authenticated users', async () => {
    mockAuth({ token: 'my-token', user: { id: 'u1' } as any });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }) as any;

    const { result } = renderHook(() => useExcludedWishes());

    // Wait for initial load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Mock subsequent fetch calls for exclude
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
    }) as any;

    await act(async () => {
      await result.current.excludeWish('w4');
    });

    expect(result.current.excludedIds).toEqual(['w4']);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/wishes/w4/exclude', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer my-token',
      },
    });
  });

  it('reverts optimistic update on exclude failure', async () => {
    mockAuth({ token: 'my-token', user: { id: 'u1' } as any });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }) as any;

    const { result } = renderHook(() => useExcludedWishes());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Mock exclude call to fail
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
    }) as any;

    await act(async () => {
      await result.current.excludeWish('w4');
    });

    // Should revert back to empty
    expect(result.current.excludedIds).toEqual([]);
  });

  it('unexcludes a wish on server for authenticated users', async () => {
    mockAuth({ token: 'my-token', user: { id: 'u1' } as any });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ['w1'],
    }) as any;

    const { result } = renderHook(() => useExcludedWishes());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
    }) as any;

    await act(async () => {
      await result.current.unexcludeWish('w1');
    });

    expect(result.current.excludedIds).toEqual([]);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/wishes/w1/exclude', {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer my-token',
      },
    });
  });

  it('reverts optimistic update on unexclude failure', async () => {
    mockAuth({ token: 'my-token', user: { id: 'u1' } as any });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ['w1'],
    }) as any;

    const { result } = renderHook(() => useExcludedWishes());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
    }) as any;

    await act(async () => {
      await result.current.unexcludeWish('w1');
    });

    // Should revert back to containing w1
    expect(result.current.excludedIds).toEqual(['w1']);
  });
});
