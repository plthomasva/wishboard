import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { io } from 'socket.io-client';
import SystemOverviewSection from '../components/admin/SystemOverviewSection';

const getMockSocket = () => (io as ReturnType<typeof vi.fn>)();

const defaultProps = {
  authHeader: { Authorization: 'Bearer test-token' },
  refreshCounter: 0,
};

/** Helper: mock fetch with configurable per-URL responses */
const mockFetch = (overrides: Record<string, object> = {}) => {
  globalThis.fetch = vi.fn().mockImplementation((url: string) => {
    for (const [key, value] of Object.entries(overrides)) {
      if (url.includes(key)) {
        return Promise.resolve({ ok: true, json: async () => value });
      }
    }
    // Default: /api/config → local mode; /api/admin/logs → empty; anything else fails
    if (url.includes('/api/config')) {
      return Promise.resolve({ ok: true, json: async () => ({ realtimeProvider: 'socketio' }) });
    }
    if (url.includes('/api/admin/logs')) {
      return Promise.resolve({ ok: true, json: async () => ({ logs: 'initial log line' }) });
    }
    if (url.includes('/api/admin/local-metrics')) {
      return Promise.resolve({ ok: true, json: async () => ({ osSamples: [], httpSamples: [], intervalMs: 5000, generatedAt: new Date().toISOString() }) });
    }
    return Promise.resolve({ ok: false });
  }) as any;
};

describe('SystemOverviewSection WebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches /api/config on mount to detect deployment mode', async () => {
    render(<SystemOverviewSection {...defaultProps} />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/config'),
    ));
  });

  it('loads initial logs via fetch on mount', async () => {
    render(<SystemOverviewSection {...defaultProps} />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/logs'),
      expect.anything(),
    ));
  });

  it('renders LocalMetricsDashboard in local (socketio) mode', async () => {
    render(<SystemOverviewSection {...defaultProps} />);
    await waitFor(() => expect(screen.getByText(/live in-process metrics/i)).toBeInTheDocument());
  });

  it('renders AwsMetricsDashboard in serverless (apigateway) mode', async () => {
    mockFetch({ '/api/config': { realtimeProvider: 'apigateway' } });
    render(<SystemOverviewSection {...defaultProps} />);
    await waitFor(() => expect(screen.getByText(/CloudWatch metrics/i)).toBeInTheDocument());
  });

  it('appends incoming sys:log events to the log display', async () => {
    render(<SystemOverviewSection {...defaultProps} />);
    await waitFor(() => expect(screen.getByText(/initial log line/i)).toBeInTheDocument());

    const socket = getMockSocket();
    const sysLogHandler = (socket.on as ReturnType<typeof vi.fn>).mock.calls
      .find(([event]: [string]) => event === 'sys:log')?.[1];
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
      .find(([event]: [string]) => event === 'sys:log')?.[1];

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

  it('handles logs fetch failure gracefully', async () => {
    mockFetch({ '/api/admin/logs': {} }); // ok:false path
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/config')) {
        return Promise.resolve({ ok: true, json: async () => ({ realtimeProvider: 'socketio' }) });
      }
      if (url.includes('/api/admin/local-metrics')) {
        return Promise.resolve({ ok: true, json: async () => ({ osSamples: [], httpSamples: [], intervalMs: 5000, generatedAt: new Date().toISOString() }) });
      }
      // logs endpoint fails
      return Promise.resolve({ ok: false });
    }) as any;

    render(<SystemOverviewSection {...defaultProps} />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/Failed to load logs\./i)).toBeInTheDocument());
  });
});
