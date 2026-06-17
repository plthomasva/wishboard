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
      json: async () => [
        { id: 'f1', content: 'Flagged wish A', user_id: 'user1', flagged: 1 }
      ]
    }) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prepends a newly flagged wish from wish:flagged event', async () => {
    render(<FlaggedWishesSection {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('Flagged wish A')).toBeInTheDocument());

    const socket = getMockSocket();
    const flaggedHandler = (socket.on as ReturnType<typeof vi.fn>).mock.calls
      .find(([event]) => event === 'wish:flagged')?.[1];
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
    const flaggedHandler = (socket.on as ReturnType<typeof vi.fn>).mock.calls
      .find(([event]) => event === 'wish:flagged')?.[1];

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
    const deletedHandler = (socket.on as ReturnType<typeof vi.fn>).mock.calls
      .find(([event]) => event === 'wish:deleted')?.[1];
    expect(deletedHandler).toBeDefined();

    act(() => {
      deletedHandler('f1');
    });

    await waitFor(() => expect(screen.queryByText('Flagged wish A')).not.toBeInTheDocument());
  });

  it('cleans up socket listeners on unmount', async () => {
    const { unmount } = render(<FlaggedWishesSection {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('Flagged wish A')).toBeInTheDocument());

    const socket = getMockSocket();
    unmount();

    expect(socket.off).toHaveBeenCalledWith('wish:flagged', expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith('wish:deleted', expect.any(Function));
  });
});
