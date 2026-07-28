import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { io } from 'socket.io-client';
import FlaggedWishesSection from '../components/admin/FlaggedWishesSection';
import React from 'react';

const getMockSocket = () => (io as ReturnType<typeof vi.fn>)();

const defaultProps = {
  authHeader: { Authorization: 'Bearer test-token' },
  setMessage: vi.fn(),
  setError: vi.fn(),
  refreshCounter: 0,
};

describe('FlaggedWishesSection WebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 'f1', content: 'Flagged wish A', user_id: 'user1', flagged: 1 }],
    }) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prepends a newly flagged wish from wish:flagged event', async () => {
    render(<FlaggedWishesSection {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('Flagged wish A')).toBeInTheDocument());

    const socket = getMockSocket();
    const flaggedHandler = (socket.on as ReturnType<typeof vi.fn>).mock.calls.find(
      ([event]) => event === 'wish:flagged'
    )?.[1];
    expect(flaggedHandler).toBeDefined();

    act(() => {
      flaggedHandler({ id: 'f2', content: 'Newly flagged wish', user_id: 'user2', flagged: 1 });
    });

    await waitFor(() => expect(screen.getByText('Newly flagged wish')).toBeInTheDocument());
  });

  it('does not add a duplicate if wish:flagged fires for an already-listed wish', async () => {
    render(<FlaggedWishesSection {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('Flagged wish A')).toBeInTheDocument());

    const socket = getMockSocket();
    const flaggedHandler = (socket.on as ReturnType<typeof vi.fn>).mock.calls.find(
      ([event]) => event === 'wish:flagged'
    )?.[1];

    act(() => {
      flaggedHandler({ id: 'f1', content: 'Flagged wish A', user_id: 'user1', flagged: 1 });
    });

    // Still only one instance
    expect(screen.getAllByText('Flagged wish A')).toHaveLength(1);
  });

  it('removes a wish from the list when wish:deleted fires', async () => {
    render(<FlaggedWishesSection {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('Flagged wish A')).toBeInTheDocument());

    const socket = getMockSocket();
    const deletedHandler = (socket.on as ReturnType<typeof vi.fn>).mock.calls.find(
      ([event]) => event === 'wish:deleted'
    )?.[1];
    expect(deletedHandler).toBeDefined();

    act(() => {
      deletedHandler('f1');
    });

    await waitFor(() => expect(screen.queryByText('Flagged wish A')).not.toBeInTheDocument());
  });

  it('subscribes to wish:* on mount and cleans up on unmount', async () => {
    const { unmount } = render(<FlaggedWishesSection {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('Flagged wish A')).toBeInTheDocument());

    const socket = getMockSocket();
    expect(socket.emit).toHaveBeenCalledWith('subscribe', { channel: 'wish:*' });

    unmount();

    expect(socket.emit).toHaveBeenCalledWith('unsubscribe', { channel: 'wish:*' });
    expect(socket.off).toHaveBeenCalledWith('wish:flagged', expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith('wish:deleted', expect.any(Function));
  });

  it('handles load error gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as any;
    render(<FlaggedWishesSection {...defaultProps} />);
    await waitFor(() =>
      expect(defaultProps.setError).toHaveBeenCalledWith('Unable to load flagged wishes.')
    );
  });

  it('allows removing a wish', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url, init) => {
      if (url === '/api/admin/flags') {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 'f1', content: 'Flagged wish A', user_id: 'user1', flagged: 1 }],
        });
      }
      if (url === '/api/admin/wishes/f1/remove' && init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      }
      return Promise.resolve({ ok: false });
    }) as any;

    render(<FlaggedWishesSection {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('Flagged wish A')).toBeInTheDocument());

    const removeBtn = screen.getByRole('button', { name: /^Remove$/i });
    act(() => {
      removeBtn.click();
    });

    await waitFor(() => expect(defaultProps.setMessage).toHaveBeenCalledWith('Removed wish f1'));
  });

  it('allows clearing a flag for a single wish', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url, init) => {
      if (url === '/api/admin/flags') {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 'f1', content: 'Flagged wish A', user_id: 'user1', flagged: 1 }],
        });
      }
      if (url === '/api/admin/wishes/f1/clear-flag' && init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      }
      return Promise.resolve({ ok: false });
    }) as any;

    render(<FlaggedWishesSection {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('Flagged wish A')).toBeInTheDocument());

    const clearBtn = screen.getByRole('button', { name: /Clear Flag/i });
    act(() => {
      clearBtn.click();
    });

    await waitFor(() =>
      expect(defaultProps.setMessage).toHaveBeenCalledWith('Cleared flag for wish f1')
    );
  });

  it('allows clearing all flags with confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    globalThis.fetch = vi.fn().mockImplementation((url, init) => {
      if (url === '/api/admin/flags') {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 'f1', content: 'Flagged wish A', user_id: 'user1', flagged: 1 }],
        });
      }
      if (url === '/api/admin/wishes/clear-all-flags' && init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      }
      return Promise.resolve({ ok: false });
    }) as any;

    render(<FlaggedWishesSection {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('Flagged wish A')).toBeInTheDocument());

    const clearAllBtn = screen.getByRole('button', { name: /Clear All Flags/i });
    act(() => {
      clearAllBtn.click();
    });

    await waitFor(() =>
      expect(defaultProps.setMessage).toHaveBeenCalledWith('Cleared all flags successfully.')
    );
  });
});
