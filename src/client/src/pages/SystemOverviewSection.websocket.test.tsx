import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { io } from 'socket.io-client';
import SystemOverviewSection from '../components/admin/SystemOverviewSection';
import React from 'react';

const getMockSocket = () => (io as ReturnType<typeof vi.fn>)();

const defaultProps = {
  authHeader: { Authorization: 'Bearer test-token' },
  token: 'test-token',
  refreshCounter: 0,
};

describe('SystemOverviewSection WebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('metrics-ticket')) {
        return Promise.resolve({ ok: true, json: async () => ({ ticket: 'abc123' }) });
      }
      if (url.includes('logs')) {
        return Promise.resolve({ ok: true, json: async () => ({ logs: 'initial log line' }) });
      }
      return Promise.resolve({ ok: false });
    }) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads initial logs via fetch on mount', async () => {
    render(<SystemOverviewSection {...defaultProps} />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/logs'),
      expect.anything()
    ));
  });

  it('appends incoming sys:log events to the log display', async () => {
    render(<SystemOverviewSection {...defaultProps} />);
    await waitFor(() => expect(screen.getByText(/initial log line/i)).toBeInTheDocument());

    const socket = getMockSocket();
    const sysLogHandler = (socket.on as ReturnType<typeof vi.fn>).mock.calls
      .find(([event]) => event === 'sys:log')?.[1];
    expect(sysLogHandler).toBeDefined();

    act(() => {
      sysLogHandler('[2026-01-01 00:00:00] info: A new live log entry');
    });

    await waitFor(() => expect(screen.getByText(/A new live log entry/)).toBeInTheDocument());
  });

  it('appends multiple log lines in sequence', async () => {
    render(<SystemOverviewSection {...defaultProps} />);
    await waitFor(() => expect(screen.getByText(/initial log line/i)).toBeInTheDocument());

    const socket = getMockSocket();
    const sysLogHandler = (socket.on as ReturnType<typeof vi.fn>).mock.calls
      .find(([event]) => event === 'sys:log')?.[1];

    act(() => {
      sysLogHandler('Line alpha');
      sysLogHandler('Line beta');
    });

    await waitFor(() => {
      expect(screen.getByText(/Line alpha/)).toBeInTheDocument();
      expect(screen.getByText(/Line beta/)).toBeInTheDocument();
    });
  });

  it('cleans up sys:log listener on unmount', async () => {
    const { unmount } = render(<SystemOverviewSection {...defaultProps} />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    const socket = getMockSocket();
    unmount();

    expect(socket.off).toHaveBeenCalledWith('sys:log', expect.any(Function));
  });

  it('handles metrics-ticket fetch failure gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as any;
    render(<SystemOverviewSection {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('Loading metrics...')).toBeInTheDocument());
  });

  it('handles logs fetch failure gracefully', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('metrics-ticket')) {
        return Promise.resolve({ ok: true, json: async () => ({ ticket: 'abc123' }) });
      }
      return Promise.resolve({ ok: false });
    }) as any;

    render(<SystemOverviewSection {...defaultProps} />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    // Component sets rawLogs to 'Failed to load logs.' on fetch error
    await waitFor(() => expect(screen.getByText(/Failed to load logs\./i)).toBeInTheDocument());
  });
});
