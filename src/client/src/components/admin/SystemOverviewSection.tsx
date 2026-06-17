import React, { useState, useEffect, useMemo, useRef } from 'react';

export default function SystemOverviewSection({ authHeader, token, refreshCounter }: any) {
  const [metricsTicket, setMetricsTicket] = useState<string | null>(null);
  const [rawLogs, setRawLogs] = useState<string>('');
  const [filterRepeating, setFilterRepeating] = useState<boolean>(true);
  const [isTailing, setIsTailing] = useState<boolean>(true);
  const logsEndRef = useRef<HTMLPreElement>(null);

  const loadMetricsTicket = async () => {
    try {
      const response = await fetch('/api/admin/metrics-ticket', { headers: authHeader });
      if (!response.ok) return;
      const data = await response.json();
      setMetricsTicket(data.ticket);
    } catch (e) { console.error('Failed to load metrics ticket:', e); }
  };

  const loadLogs = async () => {
    try {
      const response = await fetch('/api/admin/logs', { headers: authHeader });
      if (!response.ok) { setRawLogs('Failed to load logs.'); return; }
      const data = await response.json();
      setRawLogs(data.logs || '');
    } catch (e) { console.error(e); setRawLogs('Failed to load logs.'); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadMetricsTicket(); loadLogs(); }, [refreshCounter]);

  const displayLogs = useMemo(() => {
    const logsString = rawLogs || '';
    if (!filterRepeating) return logsString;
    return logsString.split('\n').filter(line => !line.includes('/api/admin/logs') && !line.includes('/api/wishes/random')).join('\n');
  }, [rawLogs, filterRepeating]);

  useEffect(() => {
    if (isTailing && logsEndRef.current) logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight;
  }, [displayLogs, isTailing]);

  useEffect(() => {
    if (!isTailing || !token) return;
    let isActive = true;
    const poll = async () => {
      try {
        const response = await fetch('/api/admin/logs', { headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) {
          const data = await response.json();
          if (isActive) setRawLogs(data.logs || '');
        }
      } catch (e) { console.error(e); }
    };
    const interval = setInterval(poll, 2000);
    return () => { isActive = false; clearInterval(interval); };
  }, [isTailing, token]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <section>
        <h2>System Metrics</h2>
        <p>Real-time server performance and request statistics.</p>
        {metricsTicket ? (
          <iframe src={`/api/admin/metrics?ticket=${metricsTicket}`} style={{ width: '100%', height: '400px', border: '1px solid #ccc', background: '#fff', borderRadius: '4px', marginTop: '12px' }} title="System Metrics" />
        ) : <p>Loading metrics...</p>}
      </section>

      <section>
        <h2>System Logs</h2>
        <p>Recent server logs including rate limit warnings and failed logins.</p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <button type="button" className="secondary-button" onClick={() => setIsTailing(!isTailing)}>{isTailing ? 'Pause Tailing' : 'Resume Tailing'}</button>
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
