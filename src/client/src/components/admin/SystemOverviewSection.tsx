import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import AwsMetricsDashboard from './AwsMetricsDashboard';
import LocalMetricsDashboard from './LocalMetricsDashboard';

export default function SystemOverviewSection({ authHeader, refreshCounter }: any) {
  const [rawLogs, setRawLogs] = useState<string>('');
  const [filterRepeating, setFilterRepeating] = useState<boolean>(true);
  const [isTailing, setIsTailing] = useState<boolean>(true);
  const [logsSource, setLogsSource] = useState<string>('local');

  /** Whether the backend is running in AWS serverless (Lambda) mode */
  const [isServerlessMode, setIsServerlessMode] = useState<boolean | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const { socket } = useWebSocket();

  // Detect deployment mode from /api/config
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((cfg) => setIsServerlessMode(cfg.realtimeProvider === 'apigateway'))
      .catch(() => setIsServerlessMode(false));
  }, []);

  const loadLogs = async () => {
    try {
      const response = await fetch(`/api/admin/logs?_t=${Date.now()}`, {
        headers: { ...authHeader, 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) {
        setRawLogs('Failed to load logs.');
        return;
      }
      const data = await response.json();
      setRawLogs(data.logs || '');
      setLogsSource(data.source || 'local');
    } catch (e) {
      console.error(e);
      setRawLogs('Failed to load logs.');
    }
  };

  useEffect(() => {
    loadLogs();
  }, [refreshCounter]);

  const parsedLogs = useMemo(() => {
    const logsString = rawLogs || '';
    if (logsString === 'Failed to load logs.') {
      return [
        {
          id: 'error-load',
          prefix: '',
          timestamp: '',
          level: 'error' as const,
          message: 'Failed to load logs.',
          raw: 'Failed to load logs.',
        },
      ];
    }
    const lines = logsString.split('\n');
    const filteredLines = filterRepeating
      ? lines.filter(
          (line) =>
            !line.includes('/api/admin/logs') &&
            !line.includes('/api/wishes/random') &&
            !line.includes('/api/admin/local-metrics')
        )
      : lines;

    // eslint-disable-next-line no-control-regex -- intentionally matches ANSI escape sequences
    const ansiRegex = /\u001b?\[[0-9;]*m/g; // NOSONAR
    const logRegex = /^(\[WS\])?\s*(?:\[([^\]]+)\])?\s*(\w+):\s*(.*)$/;

    return filteredLines.map((line, idx) => {
      const cleanLine = line.replace(ansiRegex, '').trim();
      if (!cleanLine) {
        return {
          id: `${idx}-empty`,
          prefix: '',
          timestamp: '',
          level: 'other' as const,
          message: '',
          raw: '',
        };
      }

      const match = logRegex.exec(cleanLine);
      if (match) {
        const prefix = match[1]?.trim() || '';
        const timestamp = match[2]?.trim() || '';
        const rawLevel = match[3]?.trim().toLowerCase() || 'other';
        const message = match[4] || '';

        let level: 'info' | 'warn' | 'error' | 'debug' | 'other' = 'other';
        if (rawLevel === 'info') level = 'info';
        else if (rawLevel === 'warn' || rawLevel === 'warning') level = 'warn';
        else if (rawLevel === 'error' || rawLevel === 'err') level = 'error';
        else if (rawLevel === 'debug') level = 'debug';

        return {
          id: `${idx}-${timestamp}-${message.slice(0, 10)}`,
          prefix,
          timestamp,
          level,
          message,
          raw: cleanLine,
        };
      }

      let level: 'info' | 'warn' | 'error' | 'debug' | 'other' = 'other';
      const cleanLower = cleanLine.toLowerCase();
      if (cleanLower.includes('error') || cleanLower.includes('err:')) level = 'error';
      else if (cleanLower.includes('warn') || cleanLower.includes('warning:')) level = 'warn';
      else if (cleanLower.includes('info:')) level = 'info';
      else if (cleanLower.includes('debug:')) level = 'debug';

      return {
        id: `${idx}-fallback`,
        prefix: cleanLine.startsWith('[WS]') ? '[WS]' : '',
        timestamp: '',
        level,
        message: cleanLine.startsWith('[WS]') ? cleanLine.replace(/^\[WS\]\s*/, '') : cleanLine,
        raw: cleanLine,
      };
    });
  }, [rawLogs, filterRepeating]);

  useEffect(() => {
    if (isTailing && logsEndRef.current)
      logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight;
  }, [parsedLogs, isTailing]);

  useEffect(() => {
    if (!socket) return;

    const handleNewLog = (logEntry: string) => {
      setRawLogs((prev = '') => {
        const lines = prev.split('\n');
        if (lines.length > 2000) lines.splice(0, lines.length - 2000);
        return lines.join('\n') + (prev ? '\n' : '') + logEntry;
      });
    };

    // sys:log is an admin-only, opt-in channel. Subscribe while this view is
    // mounted (re-subscribing after any reconnect), and unsubscribe on unmount so
    // an admin who navigates to another tab stops receiving the log stream. The
    // server rejects the subscription unless the token is an admin's. See #189.
    const token = (authHeader?.Authorization || '').replace(/^Bearer\s+/i, '');
    const subscribe = () => socket.emit('subscribe', { channel: 'sys:log', token });

    socket.on('sys:log', handleNewLog);
    socket.on('connect', subscribe);
    subscribe();

    return () => {
      socket.emit('unsubscribe', { channel: 'sys:log' });
      socket.off('sys:log', handleNewLog);
      socket.off('connect', subscribe);
    };
  }, [socket, authHeader]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <section>
        <h2>System Metrics</h2>

        {isServerlessMode === null && (
          <p style={{ color: '#6b7280', fontSize: '13px' }}>Detecting deployment mode…</p>
        )}

        {isServerlessMode === true && (
          <>
            <p style={{ marginBottom: '16px', color: '#9ca3af', fontSize: '13px' }}>
              Live CloudWatch metrics from your AWS serverless deployment — Lambda, API Gateway, and
              CloudFront.
            </p>
            <AwsMetricsDashboard authHeader={authHeader} />
          </>
        )}

        {isServerlessMode === false && (
          <>
            <p style={{ marginBottom: '16px', color: '#9ca3af', fontSize: '13px' }}>
              Live in-process metrics — CPU, memory, and HTTP traffic.
            </p>
            <LocalMetricsDashboard authHeader={authHeader} />
          </>
        )}
      </section>

      <section>
        <h2>System Logs</h2>
        <p>
          {logsSource === 'cloudwatch'
            ? 'Recent server logs from AWS CloudWatch Logs — last hour of Lambda activity.'
            : 'Recent server logs including rate limit warnings and failed logins.'}
        </p>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginTop: '12px',
            marginBottom: '12px',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            className="secondary-button"
            onClick={() => setIsTailing(!isTailing)}
          >
            {isTailing ? 'Pause Tailing' : 'Resume Tailing'}
          </button>
          <button type="button" className="secondary-button" onClick={loadLogs}>
            Refresh Now
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <input
              type="checkbox"
              checked={filterRepeating}
              onChange={(e) => setFilterRepeating(e.target.checked)}
            />
            <span>Filter repeating logs</span>
          </label>
        </div>
        <div
          ref={logsEndRef}
          style={{
            background: '#121214',
            border: '1px solid #2a2a2e',
            borderRadius: '6px',
            padding: '12px',
            overflowY: 'auto',
            height: '400px',
            fontFamily: 'JetBrains Mono, Fira Code, Monaco, Consolas, monospace',
            fontSize: '12px',
            lineHeight: '1.5',
            color: '#e4e4e7',
          }}
        >
          {parsedLogs.some((line) => line.raw) ? (
            parsedLogs.map((line, idx) => {
              if (!line.raw) return null;

              let levelColor = '#a1a1aa';
              let levelBg = 'transparent';
              if (line.level === 'info') {
                levelColor = '#4ade80';
              } else if (line.level === 'warn') {
                levelColor = '#fbbf24';
              } else if (line.level === 'error') {
                levelColor = '#f87171';
                levelBg = 'rgba(248, 113, 113, 0.1)';
              } else if (line.level === 'debug') {
                levelColor = '#60a5fa';
              }

              return (
                <div
                  key={line.id || idx}
                  style={{
                    display: 'flex',
                    padding: '2px 4px',
                    borderRadius: '3px',
                    backgroundColor: levelBg,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    alignItems: 'flex-start',
                    gap: '8px',
                    borderBottom: '1px solid #1a1a1c',
                  }}
                >
                  {line.timestamp && (
                    <span style={{ color: '#71717a', flexShrink: 0, userSelect: 'none' }}>
                      [{line.timestamp}]
                    </span>
                  )}

                  {line.prefix && (
                    <span style={{ color: '#c084fc', fontWeight: 'bold', flexShrink: 0 }}>
                      [{line.prefix}]
                    </span>
                  )}

                  {line.level !== 'other' && (
                    <span
                      style={{
                        color: levelColor,
                        fontWeight: 'bold',
                        minWidth: '45px',
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    >
                      {line.level.toUpperCase()}
                    </span>
                  )}

                  <span
                    style={{ color: line.level === 'other' ? '#a1a1aa' : '#e4e4e7', flexGrow: 1 }}
                  >
                    {line.message}
                  </span>
                </div>
              );
            })
          ) : (
            <div style={{ color: '#71717a', textAlign: 'center', paddingTop: '180px' }}>
              No logs available.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
