import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import AwsMetricsDashboard from './AwsMetricsDashboard';
import LocalMetricsDashboard from './LocalMetricsDashboard';

export default function SystemOverviewSection({ authHeader, refreshCounter }: any) {
  const [rawLogs, setRawLogs] = useState<string>('');
  const [filterRepeating, setFilterRepeating] = useState<boolean>(true);
  const [isTailing, setIsTailing] = useState<boolean>(true);

  /** Whether the backend is running in AWS serverless (Lambda) mode */
  const [isServerlessMode, setIsServerlessMode] = useState<boolean | null>(null);

  const logsEndRef = useRef<HTMLPreElement>(null);
  const { socket } = useWebSocket();

  // Detect deployment mode from /api/config
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(cfg => setIsServerlessMode(cfg.realtimeProvider === 'apigateway'))
      .catch(() => setIsServerlessMode(false));
  }, []);

  const loadLogs = async () => {
    try {
      const response = await fetch('/api/admin/logs', { headers: authHeader });
      if (!response.ok) { setRawLogs('Failed to load logs.'); return; }
      const data = await response.json();
      setRawLogs(data.logs || '');
    } catch (e) { console.error(e); setRawLogs('Failed to load logs.'); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadLogs(); }, [refreshCounter]);

  const displayLogs = useMemo(() => {
    const logsString = rawLogs || '';
    if (!filterRepeating) return logsString;
    return logsString
      .split('\n')
      .filter(line => !line.includes('/api/admin/logs') && !line.includes('/api/wishes/random') && !line.includes('/api/admin/local-metrics'))
      .join('\n');
  }, [rawLogs, filterRepeating]);

  useEffect(() => {
    if (isTailing && logsEndRef.current) logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight;
  }, [displayLogs, isTailing]);

  useEffect(() => {
    if (!socket) return;

    const handleNewLog = (logEntry: string) => {
      setRawLogs((prev = '') => {
        const lines = prev.split('\n');
        if (lines.length > 2000) lines.splice(0, lines.length - 2000);
        return lines.join('\n') + (prev ? '\n' : '') + logEntry;
      });
    };

    socket.on('sys:log', handleNewLog);
    return () => { socket.off('sys:log', handleNewLog); };
  }, [socket]);

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
              Live CloudWatch metrics from your AWS serverless deployment — Lambda, API Gateway, and CloudFront.
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
        <p>Recent server logs including rate limit warnings and failed logins.</p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <button type="button" className="secondary-button" onClick={() => setIsTailing(!isTailing)}>
            {isTailing ? 'Pause Tailing' : 'Resume Tailing'}
          </button>
          <button type="button" className="secondary-button" onClick={loadLogs}>Refresh Now</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
            <input type="checkbox" checked={filterRepeating} onChange={(e) => setFilterRepeating(e.target.checked)} />
            <span>Filter repeating logs</span>
          </label>
        </div>
        <pre ref={logsEndRef} style={{ background: '#1e1e1e', color: '#d4d4d4', padding: '12px', overflowX: 'auto', height: '400px', borderRadius: '4px', fontSize: '12px' }}>
          {displayLogs || 'No logs available.'}
        </pre>
      </section>
    </div>
  );
}
