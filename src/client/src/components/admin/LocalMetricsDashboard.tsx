/**
 * LocalMetricsDashboard
 *
 * Renders live in-process server metrics for local/Docker deployments.
 * Fetches from GET /api/admin/local-metrics (backed by metricsCollector.js).
 *
 * Shares the same visual design as AwsMetricsDashboard — Recharts sparklines,
 * dark colour palette, stat-card + chart layout.
 *
 * Metrics shown:
 *   - CPU usage %
 *   - Heap used / heap total (MB)
 *   - RSS memory (MB)
 *   - OS load average (1-min)
 *   - HTTP request counts by status class (2xx / 4xx / 5xx)
 *   - Mean response time (ms)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OsSample {
  ts: number;
  cpu: number;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  load: number;
}

interface HttpSample {
  ts: number;
  r2xx: number;
  r3xx: number;
  r4xx: number;
  r5xx: number;
  count: number;
  mean: number;
}

interface LocalMetricsResponse {
  osSamples: OsSample[];
  httpSamples: HttpSample[];
  intervalMs: number;
  generatedAt: string;
}

// ── Colour palette (same tokens as AwsMetricsDashboard) ───────────────────────

const C = {
  blue:   { stroke: '#60a5fa', fill: '#1d4ed8' },
  green:  { stroke: '#34d399', fill: '#065f46' },
  purple: { stroke: '#a78bfa', fill: '#4c1d95' },
  pink:   { stroke: '#e879f9', fill: '#701a75' },
  red:    { stroke: '#f87171', fill: '#991b1b' },
  orange: { stroke: '#fb923c', fill: '#92400e' },
  teal:   { stroke: '#2dd4bf', fill: '#134e4a' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatTime = (ts: number): string =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

const formatShortTime = (ts: number): string =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

// ── Shared sub-components ─────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
  label?: number;
  unit?: string;
}

const ChartTooltip = ({ active, payload, label, unit = '' }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1e1e2e', border: '1px solid #374151', borderRadius: '6px',
      padding: '8px 12px', fontSize: '12px', color: '#e5e7eb',
    }}>
      <div style={{ color: '#9ca3af', marginBottom: '4px' }}>{label !== undefined ? formatTime(label) : ''}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color ?? '#e5e7eb' }}>
          {p.name && <span style={{ marginRight: 4 }}>{p.name}:</span>}
          <strong>{typeof p.value === 'number' ? `${p.value.toFixed(1)}${unit}` : '—'}</strong>
        </div>
      ))}
    </div>
  );
};

interface CardProps {
  title: string;
  headline: string;
  headlineNote?: string;
  children: React.ReactNode;
}

const MetricCard = ({ title, headline, headlineNote, children }: CardProps) => (
  <div style={{
    background: '#111827', border: '1px solid #1f2937', borderRadius: '8px',
    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px' }}>
      <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>{title}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: '20px', fontWeight: 700, color: '#f9fafb', letterSpacing: '-0.5px' }}>{headline}</span>
        {headlineNote && <span style={{ fontSize: '10px', color: '#6b7280', marginLeft: '4px' }}>{headlineNote}</span>}
      </div>
    </div>
    {children}
  </div>
);

const NoData = () => (
  <div style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', fontSize: '12px' }}>
    Collecting…
  </div>
);

// Gradient defs — inlined as a helper function to avoid JSX component overload issues
const gradDef = (id: string, color: { stroke: string }) => (
  <defs>
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%"  stopColor={color.stroke} stopOpacity={0.4} />
      <stop offset="95%" stopColor={color.stroke} stopOpacity={0} />
    </linearGradient>
  </defs>
);

// Shared XAxis tick style — applied inline to avoid TypeScript overload issues with spreads
const TICK_STYLE = { fontSize: 9, fill: '#6b7280' };

// ── OS Metric Cards ───────────────────────────────────────────────────────────

const CpuCard = ({ samples }: { samples: OsSample[] }) => {
  const latest = samples.at(-1)?.cpu ?? 0;
  return (
    <MetricCard title="CPU Usage" headline={`${latest.toFixed(1)}%`} headlineNote="current">
      {samples.length > 1 ? (
        <ResponsiveContainer width="100%" height={70}>
          <AreaChart data={samples} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            {gradDef('grad-cpu', C.blue)}
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis dataKey="ts" tickFormatter={formatShortTime} tick={TICK_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={40} />
            <YAxis hide domain={[0, 100]} />
            <Tooltip content={(p) => <ChartTooltip {...p as any} unit="%" />} />
            <Area type="monotone" dataKey="cpu" stroke={C.blue.stroke} strokeWidth={1.5} fill="url(#grad-cpu)" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : <NoData />}
    </MetricCard>
  );
};

const HeapCard = ({ samples }: { samples: OsSample[] }) => {
  const latest = samples.at(-1);
  const usedPct = latest ? Math.round((latest.heapUsed / latest.heapTotal) * 100) : 0;
  return (
    <MetricCard title="Heap Usage" headline={`${latest?.heapUsed.toFixed(0) ?? 0} MB`} headlineNote={`${usedPct}% of ${latest?.heapTotal.toFixed(0) ?? 0} MB limit`}>
      {samples.length > 1 ? (
        <ResponsiveContainer width="100%" height={70}>
          <AreaChart data={samples} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            {gradDef('grad-heap', C.purple)}
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis dataKey="ts" tickFormatter={formatShortTime} tick={TICK_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={40} />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip content={(p) => <ChartTooltip {...p as any} unit=" MB" />} />
            <Area type="monotone" dataKey="heapUsed" name="Heap Used" stroke={C.purple.stroke} strokeWidth={1.5} fill="url(#grad-heap)" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : <NoData />}
    </MetricCard>
  );
};

const RssCard = ({ samples }: { samples: OsSample[] }) => {
  const latest = samples.at(-1)?.rss ?? 0;
  return (
    <MetricCard title="RSS Memory" headline={`${latest.toFixed(0)} MB`} headlineNote="resident set size">
      {samples.length > 1 ? (
        <ResponsiveContainer width="100%" height={70}>
          <AreaChart data={samples} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            {gradDef('grad-rss', C.pink)}
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis dataKey="ts" tickFormatter={formatShortTime} tick={TICK_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={40} />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip content={(p) => <ChartTooltip {...p as any} unit=" MB" />} />
            <Area type="monotone" dataKey="rss" stroke={C.pink.stroke} strokeWidth={1.5} fill="url(#grad-rss)" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : <NoData />}
    </MetricCard>
  );
};

const LoadCard = ({ samples }: { samples: OsSample[] }) => {
  const latest = samples.at(-1)?.load ?? 0;
  return (
    <MetricCard title="Load Average" headline={latest.toFixed(2)} headlineNote="1-min">
      {samples.length > 1 ? (
        <ResponsiveContainer width="100%" height={70}>
          <AreaChart data={samples} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            {gradDef('grad-load', C.teal)}
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis dataKey="ts" tickFormatter={formatShortTime} tick={TICK_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={40} />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip content={(p) => <ChartTooltip {...p as any} />} />
            <Area type="monotone" dataKey="load" stroke={C.teal.stroke} strokeWidth={1.5} fill="url(#grad-load)" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : <NoData />}
    </MetricCard>
  );
};

// ── HTTP Metric Cards ─────────────────────────────────────────────────────────

const RequestRateCard = ({ samples }: { samples: HttpSample[] }) => {
  // Sum 2xx+3xx over last 10 samples for a "recent" feel
  const recent = samples.slice(-10);
  const total = recent.reduce((s, p) => s + p.r2xx + p.r3xx, 0);
  return (
    <MetricCard title="Successful Requests" headline={String(total)} headlineNote="last 50s">
      {samples.length > 1 ? (
        <ResponsiveContainer width="100%" height={70}>
          <AreaChart data={samples} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            {gradDef('grad-req', C.green)}
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis dataKey="ts" tickFormatter={formatShortTime} tick={TICK_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={40} />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip content={(p) => <ChartTooltip {...p as any} />} />
            <Area type="monotone" dataKey="r2xx" name="2xx" stroke={C.green.stroke} strokeWidth={1.5} fill="url(#grad-req)" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : <NoData />}
    </MetricCard>
  );
};

const ErrorRateCard = ({ samples }: { samples: HttpSample[] }) => {
  const recent = samples.slice(-10);
  const total4xx = recent.reduce((s, p) => s + p.r4xx, 0);
  const total5xx = recent.reduce((s, p) => s + p.r5xx, 0);
  return (
    <MetricCard title="Error Responses" headline={String(total4xx + total5xx)} headlineNote="last 50s">
      {samples.length > 1 ? (
        <ResponsiveContainer width="100%" height={70}>
          <LineChart data={samples} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis dataKey="ts" tickFormatter={formatShortTime} tick={TICK_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={40} />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip content={(p) => <ChartTooltip {...p as any} />} />
            <Line type="monotone" dataKey="r4xx" name="4xx" stroke={C.orange.stroke} strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="r5xx" name="5xx" stroke={C.red.stroke}    strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : <NoData />}
    </MetricCard>
  );
};

const LatencyCard = ({ samples }: { samples: HttpSample[] }) => {
  // Weighted mean of the last 12 samples (≈1 min)
  const window = samples.slice(-12).filter(s => s.count > 0);
  const totalCount = window.reduce((s, p) => s + p.count, 0);
  const weightedMean = totalCount > 0
    ? window.reduce((s, p) => s + p.mean * p.count, 0) / totalCount
    : 0;

  return (
    <MetricCard title="Mean Response Time" headline={`${weightedMean.toFixed(1)} ms`} headlineNote="last 60s">
      {samples.length > 1 ? (
        <ResponsiveContainer width="100%" height={70}>
          <AreaChart data={samples.filter(s => s.count > 0)} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            {gradDef('grad-lat', C.purple)}
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis dataKey="ts" tickFormatter={formatShortTime} tick={TICK_STYLE} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={40} />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip content={(p) => <ChartTooltip {...p as any} unit=" ms" />} />
            <Area type="monotone" dataKey="mean" name="Mean" stroke={C.purple.stroke} strokeWidth={1.5} fill="url(#grad-lat)" dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : <NoData />}
    </MetricCard>
  );
};

// ── Section headers ───────────────────────────────────────────────────────────

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#d1d5db', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
    {children}
  </h3>
);

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginBottom: '28px' }}>
    {children}
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

const AUTO_REFRESH_MS = 10_000; // 10s — matches 2× the 5s sample interval

interface LocalMetricsDashboardProps {
  authHeader: Record<string, string>;
}

export default function LocalMetricsDashboard({ authHeader }: LocalMetricsDashboardProps) {
  const [data, setData] = useState<LocalMetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/local-metrics', { headers: authHeader });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchMetrics, AUTO_REFRESH_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchMetrics]);

  return (
    <div style={{ color: '#e5e7eb' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button type="button" className="secondary-button" onClick={fetchMetrics} disabled={loading}>
          {loading ? '⟳ Refreshing…' : '⟳ Refresh Now'}
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#9ca3af', cursor: 'pointer' }}>
          <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
          Auto-refresh every 10s
        </label>
        {data?.generatedAt && (
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6b7280' }}>
            Last updated: {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </span>
        )}
      </div>

      {error && (
        <div style={{ background: '#1c0a0a', border: '1px solid #7f1d1d', borderRadius: '6px', padding: '12px 16px', color: '#fca5a5', fontSize: '13px', marginBottom: '16px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading && !data && (
        <div style={{ color: '#6b7280', fontSize: '13px', padding: '24px 0' }}>Loading metrics…</div>
      )}

      {data && (
        <>
          <SectionTitle>Process &amp; System</SectionTitle>
          <Grid>
            <CpuCard  samples={data.osSamples} />
            <HeapCard samples={data.osSamples} />
            <RssCard  samples={data.osSamples} />
            <LoadCard samples={data.osSamples} />
          </Grid>

          <SectionTitle>HTTP Traffic</SectionTitle>
          <Grid>
            <RequestRateCard samples={data.httpSamples} />
            <ErrorRateCard   samples={data.httpSamples} />
            <LatencyCard     samples={data.httpSamples} />
          </Grid>
        </>
      )}

      <p style={{ fontSize: '11px', color: '#374151', marginTop: '4px' }}>
        Sampled every {data ? data.intervalMs / 1000 : 5}s. Up to 60 minutes of history retained.
      </p>
    </div>
  );
}
