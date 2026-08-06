import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useFlagWish from './useFlagWish';

describe('useFlagWish', () => {
  const onSuccess = vi.fn();
  let confirmSpy: any;
  let alertSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn() as any;
    confirmSpy = vi.spyOn(globalThis.window, 'confirm').mockImplementation(() => true);
    alertSpy = vi.spyOn(globalThis.window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('should not call fetch if user cancels confirmation', async () => {
    confirmSpy.mockReturnValue(false);

    const { result } = renderHook(() => useFlagWish(onSuccess));

    await act(async () => {
      await result.current('wish-1');
    });

    expect(confirmSpy).toHaveBeenCalledWith(
      'Are you sure you want to flag this wish as inappropriate?'
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('should call fetch and onSuccess if user confirms and API call succeeds', async () => {
    confirmSpy.mockReturnValue(true);
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
    });

    const { result } = renderHook(() => useFlagWish(onSuccess));

    await act(async () => {
      await result.current('wish-2');
    });

    expect(confirmSpy).toHaveBeenCalledWith(
      'Are you sure you want to flag this wish as inappropriate?'
    );
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/wishes/wish-2/flag', {
      method: 'POST',
    });
    expect(onSuccess).toHaveBeenCalledWith('wish-2');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('should call alert if user confirms and API call fails with HTTP error', async () => {
    confirmSpy.mockReturnValue(true);
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
    });

    const { result } = renderHook(() => useFlagWish(onSuccess));

    await act(async () => {
      await result.current('wish-3');
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/wishes/wish-3/flag', {
      method: 'POST',
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Failed to flag the wish.');
  });

  it('should call alert if user confirms and API call throws network error', async () => {
    confirmSpy.mockReturnValue(true);
    (globalThis.fetch as any).mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useFlagWish(onSuccess));

    await act(async () => {
      await result.current('wish-4');
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/wishes/wish-4/flag', {
      method: 'POST',
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Network Error');
  });
});
