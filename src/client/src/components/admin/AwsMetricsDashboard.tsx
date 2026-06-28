/**
 * AwsMetricsDashboard
 *
 * Renders live CloudWatch metrics for the Wishboard serverless deployment.
 * Fetches data from GET /api/admin/aws-metrics, which is only active when
 * running in AWS Lambda mode. Displays time-series sparkline charts grouped
 * by AWS service (Lambda, API Gateway, CloudFront).
 *
 * Auto-refreshes every 30 seconds by default.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DataPoint {
  /** ISO 8601 timestamp */
  t: string;
  /** Metric value */
  v: number;
}

interface MetricSeries {
  id: string;
  label: string;
  dataPoints: DataPoint[];
}

interface MetricGroup {
  title: string;
  metrics: MetricSeries[];
}

interface AwsMetricsResponse {
  groups: MetricGroup[];
  generatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format an ISO timestamp to HH:MM for axis labels */
const formatTime = (isoString: string): string => {
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '';
  }
};

/** Format a value with up to 1 decimal place, collapsing to integer when whole */
const formatValue = (value: number, label: string): string => {
  if (label.toLowerCase().includes('bytes')) {
    if (value >= 1_073_741_824) return `${(value / 1_073_741_824).toFixed(2)} GB`;
    if (value >= 1_048_576) return `${(value / 1_048_576).toFixed(1)} MB`;
    if (value >= 1_024) return `${(value / 1_024).toFixed(1)} KB`;
    return `${value} B`;
  }
  if (label.includes('(ms)')) return `${Math.round(value)} ms`;
  if (label.includes('(%)')) return `${value.toFixed(1)}%`;
  if (value === 0) return '0';
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
};

/** Derive a "current value" (latest non-zero, or last value) for the stat badge */
const currentValue = (dataPoints: DataPoint[]): number => {
  if (!dataPoints.length) return 0;
  for (let i = dataPoints.length - 1; i >= 0; i--) {
    if (dataPoints[i].v !== 0) return dataPoints[i].v;
  }
  return dataPoints.at(-1)!.v;
};

/** Sum of all values — used for invocation/error counts */
const sumValues = (dataPoints: DataPoint[]): number =>
  dataPoints.reduce((acc, p) => acc + p.v, 0);

/** Determine if a metric is a counter (Sum stat) vs a gauge (Average/p99/Maximum) */
const isCounter = (label: string): boolean =>
  label.toLowerCase().includes('invocation') ||
  label.toLowerCase().includes('error') ||
  label.toLowerCase().includes('throttle') ||
  label.toLowerCase().includes('request') ||
  label.toLowerCase().includes('bytes') ||
  label.toLowerCase().includes('count') ||
  label.toLowerCase().includes('messages');

// ── Colour palette ─────────────────────────────────────────────────────────────

const COLORS: Record<string, { stroke: string; fill: string }> = {
  default:    { stroke: '#60a5fa', fill: '#1d4ed8' },   // blue
  error:      { stroke: '#f87171', fill: '#991b1b' },   // red
  throttle:   { stroke: '#fb923c', fill: '#92400e' },   // orange
  duration:   { stroke: '#a78bfa', fill: '#4c1d95' },   // purple
  latency:    { stroke: '#a78bfa', fill: '#4c1d95' },   // purple
  concurrent: { stroke: '#34d399', fill: '#065f46' },   // green
  cache:      { stroke: '#34d399', fill: '#065f46' },   // green
  bytes:      { stroke: '#e879f9', fill: '#701a75' },   // pink
};

const colorForMetric = (id: string) => {
  if (id.includes('error') || id.includes('4xx') || id.includes('5xx')) return COLORS.error;
  if (id.includes('throttle')) return COLORS.throttle;
  if (id.includes('duration') || id.includes('latency')) return COLORS.duration;
  if (id.includes('concurrent')) return COLORS.concurrent;
  if (id.includes('cache')) return COLORS.cache;
  if (id.includes('bytes')) return COLORS.bytes;
  return COLORS.default;
};

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
  metricLabel: string;
}

const CustomTooltip = ({ active, payload, label: rawLabel, metricLabel }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? 0;
  return (
    <div style={{
      background: '#1e1e2e',
      border: '1px solid #374151',
      borderRadius: '6px',
      padding: '8px 12px',
      fontSize: '12px',
      color: '#e5e7eb',
    }}>
      <div style={{ color: '#9ca3af', marginBottom: '4px' }}>{formatTime(rawLabel ?? '')}</div>
      <div><strong>{formatValue(value, metricLabel)}</strong></div>
    </div>
  );
};

// ── Sparkline Card ─────────────────────────────────────────────────────────────

interface SparklineCardProps {
  metric: MetricSeries;
}

const SparklineCard: React.FC<SparklineCardProps> = ({ metric }) => {
  const { id, label, dataPoints } = metric;
  const color = colorForMetric(id);
  const hasData = dataPoints.some(p => p.v > 0);

  // For counters show the total over the period; for gauges show the latest
  const headline = isCounter(label)
    ? formatValue(sumValues(dataPoints), label)
    : formatValue(currentValue(dataPoints), label);

  const headlineNote = isCounter(label) ? 'last hour total' : 'latest';

  return (
    <div style={{
      background: '#111827',
      border: '1px solid #1f2937',
      borderRadius: '8px',
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '4px' }}>
        <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500, lineHeight: 1.3 }}>{label}</span>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#f9fafb', letterSpacing: '-0.5px' }}>{headline}</span>
          <span style={{ fontSize: '10px', color: '#6b7280', marginLeft: '4px' }}>{headlineNote}</span>
        </div>
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={70}>
          <AreaChart data={dataPoints} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color.stroke} stopOpacity={0.4} />
                <stop offset="95%" stopColor={color.stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis
              dataKey="t"
              tickFormatter={formatTime}
              tick={{ fontSize: 9, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip content={<CustomTooltip metricLabel={label} />} />
            <Area
              type="monotone"
              dataKey="v"
              stroke={color.stroke}
              strokeWidth={1.5}
              fill={`url(#grad-${id})`}
              dot={false}
              activeDot={{ r: 3, fill: color.stroke }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', fontSize: '12px' }}>
          No data in this period
        </div>
      )}
    </div>
  );
};

// ── Metric Group Section ───────────────────────────────────────────────────────

const MetricGroupSection: React.FC<{ group: MetricGroup }> = ({ group }) => (
  <div style={{ marginBottom: '28px' }}>
    <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#d1d5db', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
      {group.title}
    </h3>
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '12px',
    }}>
      {group.metrics.map(metric => (
        <SparklineCard key={metric.id} metric={metric} />
      ))}
    </div>
  </div>
);

// ── Main Dashboard Component ───────────────────────────────────────────────────

const AUTO_REFRESH_MS = 30_000;

interface AwsMetricsDashboardProps {
  authHeader: Record<string, string>;
}

export default function AwsMetricsDashboard({ authHeader }: Readonly<AwsMetricsDashboardProps>) {
  const [data, setData] = useState<AwsMetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/aws-metrics', { headers: authHeader });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${response.status}`);
      }
      setData(await response.json());
    } catch (err: any) {
      setError(err.message ?? 'Unknown error fetching metrics.');
    } finally {
      setLoading(false);
    }
  }, [authHeader]);

  // Initial fetch
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Auto-refresh timer
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchMetrics, AUTO_REFRESH_MS);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchMetrics]);

  return (
    <div style={{ color: '#e5e7eb' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="secondary-button"
          onClick={fetchMetrics}
          disabled={loading}
        >
          {loading ? '⟳ Refreshing…' : '⟳ Refresh Now'}
        </button>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#9ca3af', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={e => setAutoRefresh(e.target.checked)}
          />
          <span>Auto-refresh every 30s</span>
        </label>

        {data?.generatedAt && (
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6b7280' }}>
            Last updated: {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div style={{
          background: '#1c0a0a',
          border: '1px solid #7f1d1d',
          borderRadius: '6px',
          padding: '12px 16px',
          color: '#fca5a5',
          fontSize: '13px',
          marginBottom: '16px',
        }}>
          <strong>Error:</strong> {error}
          {error.toLowerCase().includes('iam') || error.toLowerCase().includes('access denied') || error.toLowerCase().includes('not authorized') ? (
            <p style={{ margin: '8px 0 0', color: '#9ca3af', fontSize: '12px' }}>
              The Lambda execution role needs <code>cloudwatch:GetMetricData</code> permission. See <code>aws-serverless/template.yaml</code> → <code>ApiFunction.Policies</code>.
            </p>
          ) : null}
        </div>
      )}

      {/* Skeleton / loading on first load */}
      {loading && !data && (
        <div style={{ color: '#6b7280', fontSize: '13px', padding: '24px 0' }}>Loading CloudWatch metrics…</div>
      )}

      {/* Metric groups */}
      {data?.groups?.map(group => (
        <MetricGroupSection key={group.title} group={group} />
      ))}

      {/* Empty state after successful fetch */}
      {!loading && !error && data?.groups?.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: '13px' }}>
          No metrics returned. The Lambda may not have received traffic yet, or CloudWatch metrics may still be propagating (can take 1–3 minutes after first invocation).
        </p>
      )}

      <p style={{ fontSize: '11px', color: '#374151', marginTop: '12px' }}>
        Showing 1-minute resolution over the last 60 minutes. CloudFront metrics require additional configuration in the SAM template (<code>CLOUDFRONT_DISTRIBUTION_ID</code> env var).
      </p>
    </div>
  );
}
