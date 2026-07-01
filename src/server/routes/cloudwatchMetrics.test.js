/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import cloudwatchMetricsRouter from './cloudwatchMetrics.js';

// Mock the auth middleware to bypass DB lookup
vi.mock('../auth.js', () => ({
  requireAdmin: (req, res, next) => {
    if (req.headers.authorization === 'Bearer admin-token') {
      req.user = { role: 'admin' };
      return next();
    }
    return res.status(403).json({ error: 'Admin access required.' });
  },
}));

// Create standard mocks for CloudWatch SDK using standard constructible functions
const mockSend = vi.fn();
let clientInstances = [];

function mockCloudWatchClient(config) {
  this.config = config;
  this.send = mockSend;
  clientInstances.push(this);
}

function mockGetMetricDataCommand(args) {
  this.args = args;
}

vi.mock('@aws-sdk/client-cloudwatch', () => {
  return {
    CloudWatchClient: mockCloudWatchClient,
    GetMetricDataCommand: mockGetMetricDataCommand,
  };
});

const app = express();
app.use(express.json());
app.use('/api/admin/aws-metrics', cloudwatchMetricsRouter);

const request = supertest(app);

describe('cloudwatchMetrics route', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockSend.mockReset();
    clientInstances = [];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('requires admin authentication', async () => {
    const res = await request.get('/api/admin/aws-metrics');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Admin access required.');
  });

  it('returns 400 when not running in serverless (Lambda) mode', async () => {
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    const res = await request
      .get('/api/admin/aws-metrics')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('AWS CloudWatch metrics are only available in serverless mode.');
  });

  it('returns 200 with grouped metrics and correct queries when in Lambda mode', async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'wishboard-express-api';
    process.env.CLOUDFRONT_DISTRIBUTION_ID = 'EDIST12345';
    process.env.AWS_REGION = 'us-west-2';

    const now = new Date();
    const earlier = new Date(now.getTime() - 5000);

    mockSend.mockResolvedValueOnce({
      MetricDataResults: [
        {
          Id: 'lambda_invocations',
          Label: 'Invocations',
          Timestamps: [now, earlier],
          Values: [5, 2],
        },
        {
          Id: 'ws_invocations',
          Label: 'WS Invocations',
          Timestamps: [now],
          Values: [10],
        },
        {
          Id: 'cf_requests',
          Label: 'CF Requests',
          Timestamps: [now],
          Values: [15],
        },
        {
          Id: 'apigw_count',
          Label: 'API Requests',
          Timestamps: [now],
          Values: [25],
        },
      ],
      NextToken: null,
    });

    const res = await request
      .get('/api/admin/aws-metrics')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    expect(res.body.generatedAt).toBeDefined();
    expect(res.body.groups).toBeDefined();

    // Verify CloudWatchClient region config
    expect(clientInstances).toHaveLength(1);
    expect(clientInstances[0].config.region).toBe('us-west-2');

    // Verify queries constructed and passed to command
    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command.args).toBeDefined();
    const queries = command.args.MetricDataQueries;
    expect(queries).toBeDefined();

    // Verify exact structure of all generated queries
    const expectedQueries = [
      {
        Id: 'lambda_invocations',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Lambda',
            MetricName: 'Invocations',
            Dimensions: [{ Name: 'FunctionName', Value: 'wishboard-express-api' }],
          },
          Period: 60,
          Stat: 'Sum',
        },
        Label: 'Invocations',
      },
      {
        Id: 'lambda_errors',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Lambda',
            MetricName: 'Errors',
            Dimensions: [{ Name: 'FunctionName', Value: 'wishboard-express-api' }],
          },
          Period: 60,
          Stat: 'Sum',
        },
        Label: 'Errors',
      },
      {
        Id: 'lambda_throttles',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Lambda',
            MetricName: 'Throttles',
            Dimensions: [{ Name: 'FunctionName', Value: 'wishboard-express-api' }],
          },
          Period: 60,
          Stat: 'Sum',
        },
        Label: 'Throttles',
      },
      {
        Id: 'lambda_duration_p50',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Lambda',
            MetricName: 'Duration',
            Dimensions: [{ Name: 'FunctionName', Value: 'wishboard-express-api' }],
          },
          Period: 60,
          Stat: 'p50',
        },
        Label: 'Duration p50 (ms)',
      },
      {
        Id: 'lambda_duration_p99',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Lambda',
            MetricName: 'Duration',
            Dimensions: [{ Name: 'FunctionName', Value: 'wishboard-express-api' }],
          },
          Period: 60,
          Stat: 'p99',
        },
        Label: 'Duration p99 (ms)',
      },
      {
        Id: 'lambda_concurrent',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Lambda',
            MetricName: 'ConcurrentExecutions',
            Dimensions: [{ Name: 'FunctionName', Value: 'wishboard-express-api' }],
          },
          Period: 60,
          Stat: 'Maximum',
        },
        Label: 'Concurrent Executions',
      },
      {
        Id: 'ws_invocations',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Lambda',
            MetricName: 'Invocations',
            Dimensions: [{ Name: 'FunctionName', Value: 'wishboard-websocket-mgr' }],
          },
          Period: 60,
          Stat: 'Sum',
        },
        Label: 'WS Invocations',
      },
      {
        Id: 'ws_errors',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Lambda',
            MetricName: 'Errors',
            Dimensions: [{ Name: 'FunctionName', Value: 'wishboard-websocket-mgr' }],
          },
          Period: 60,
          Stat: 'Sum',
        },
        Label: 'WS Errors',
      },
      {
        Id: 'apigw_count',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/ApiGateway',
            MetricName: 'Count',
            Dimensions: [{ Name: 'Stage', Value: '$default' }],
          },
          Period: 60,
          Stat: 'Sum',
        },
        Label: 'API Requests',
      },
      {
        Id: 'apigw_4xx',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/ApiGateway',
            MetricName: '4XXError',
            Dimensions: [{ Name: 'Stage', Value: '$default' }],
          },
          Period: 60,
          Stat: 'Sum',
        },
        Label: 'API 4xx Errors',
      },
      {
        Id: 'apigw_5xx',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/ApiGateway',
            MetricName: '5XXError',
            Dimensions: [{ Name: 'Stage', Value: '$default' }],
          },
          Period: 60,
          Stat: 'Sum',
        },
        Label: 'API 5xx Errors',
      },
      {
        Id: 'apigw_latency',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/ApiGateway',
            MetricName: 'Latency',
            Dimensions: [{ Name: 'Stage', Value: '$default' }],
          },
          Period: 60,
          Stat: 'p99',
        },
        Label: 'API Latency p99 (ms)',
      },
      {
        Id: 'cf_requests',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/CloudFront',
            MetricName: 'Requests',
            Dimensions: [
              { Name: 'DistributionId', Value: 'EDIST12345' },
              { Name: 'Region', Value: 'Global' },
            ],
          },
          Period: 60,
          Stat: 'Sum',
        },
        Label: 'CF Requests',
      },
      {
        Id: 'cf_bytes_dl',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/CloudFront',
            MetricName: 'BytesDownloaded',
            Dimensions: [
              { Name: 'DistributionId', Value: 'EDIST12345' },
              { Name: 'Region', Value: 'Global' },
            ],
          },
          Period: 60,
          Stat: 'Sum',
        },
        Label: 'CF Bytes Downloaded',
      },
      {
        Id: 'cf_4xx_rate',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/CloudFront',
            MetricName: '4xxErrorRate',
            Dimensions: [
              { Name: 'DistributionId', Value: 'EDIST12345' },
              { Name: 'Region', Value: 'Global' },
            ],
          },
          Period: 60,
          Stat: 'Average',
        },
        Label: 'CF 4xx Error Rate (%)',
      },
      {
        Id: 'cf_5xx_rate',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/CloudFront',
            MetricName: '5xxErrorRate',
            Dimensions: [
              { Name: 'DistributionId', Value: 'EDIST12345' },
              { Name: 'Region', Value: 'Global' },
            ],
          },
          Period: 60,
          Stat: 'Average',
        },
        Label: 'CF 5xx Error Rate (%)',
      },
      {
        Id: 'cf_cache_hit_rate',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/CloudFront',
            MetricName: 'CacheHitRate',
            Dimensions: [
              { Name: 'DistributionId', Value: 'EDIST12345' },
              { Name: 'Region', Value: 'Global' },
            ],
          },
          Period: 60,
          Stat: 'Average',
        },
        Label: 'CF Cache Hit Rate (%)',
      },
      {
        Id: 'cf_origin_latency',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/CloudFront',
            MetricName: 'OriginLatency',
            Dimensions: [
              { Name: 'DistributionId', Value: 'EDIST12345' },
              { Name: 'Region', Value: 'Global' },
            ],
          },
          Period: 60,
          Stat: 'p99',
        },
        Label: 'CF Origin Latency p99 (ms)',
      },
    ];

    expect(queries).toEqual(expectedQueries);

    // Check that groups structure contains our returned metrics
    const lambdaGroup = res.body.groups.find((g) =>
      g.title.includes('Lambda — wishboard-express-api')
    );
    expect(lambdaGroup).toBeDefined();
    expect(lambdaGroup.metrics).toHaveLength(1);
    expect(lambdaGroup.metrics[0].id).toBe('lambda_invocations');
    // Verify sorting of data points (earlier first)
    expect(lambdaGroup.metrics[0].dataPoints).toHaveLength(2);
    expect(lambdaGroup.metrics[0].dataPoints[0].v).toBe(2);
    expect(lambdaGroup.metrics[0].dataPoints[1].v).toBe(5);

    const wsGroup = res.body.groups.find((g) => g.title.includes('WebSocket Manager'));
    expect(wsGroup).toBeDefined();
    expect(wsGroup.metrics[0].id).toBe('ws_invocations');

    const cfGroup = res.body.groups.find((g) => g.title.includes('CloudFront'));
    expect(cfGroup).toBeDefined();
    expect(cfGroup.metrics).toHaveLength(1);
    expect(cfGroup.metrics[0].id).toBe('cf_requests');

    const apigwGroup = res.body.groups.find((g) => g.title.includes('API Gateway'));
    expect(apigwGroup).toBeDefined();
    expect(apigwGroup.metrics).toHaveLength(1);
    expect(apigwGroup.metrics[0].id).toBe('apigw_count');
  });

  it('omits CloudFront queries when CLOUDFRONT_DISTRIBUTION_ID is missing', async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'wishboard-express-api';
    delete process.env.CLOUDFRONT_DISTRIBUTION_ID;

    mockSend.mockResolvedValueOnce({
      MetricDataResults: [],
      NextToken: null,
    });

    await request.get('/api/admin/aws-metrics').set('Authorization', 'Bearer admin-token');

    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    const queries = command.args.MetricDataQueries;
    const cfReqQuery = queries.find((q) => q.Id === 'cf_requests');
    expect(cfReqQuery).toBeUndefined();
  });

  it('handles paginated metric results using NextToken', async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'wishboard-express-api';

    const nowIso = new Date().toISOString();
    mockSend
      .mockResolvedValueOnce({
        MetricDataResults: [
          {
            Id: 'lambda_invocations',
            Label: 'Invocations',
            Timestamps: [new Date(nowIso)],
            Values: [5],
          },
        ],
        NextToken: 'page-2-token',
      })
      .mockResolvedValueOnce({
        MetricDataResults: [
          {
            Id: 'ws_invocations',
            Label: 'WS Invocations',
            Timestamps: [new Date(nowIso)],
            Values: [10],
          },
        ],
        NextToken: null,
      });

    const res = await request
      .get('/api/admin/aws-metrics')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(2);

    // Check next token is passed to subsequent command call
    const secondCallCommand = mockSend.mock.calls[1][0];
    expect(secondCallCommand.args.NextToken).toBe('page-2-token');

    const lambdaGroup = res.body.groups.find((g) =>
      g.title.includes('Lambda — wishboard-express-api')
    );
    expect(lambdaGroup).toBeDefined();
    expect(lambdaGroup.metrics[0].id).toBe('lambda_invocations');

    const wsGroup = res.body.groups.find((g) => g.title.includes('WebSocket Manager'));
    expect(wsGroup).toBeDefined();
    expect(wsGroup.metrics[0].id).toBe('ws_invocations');
  });

  it('handles AWS CloudWatch API errors gracefully and returns 500', async () => {
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'wishboard-express-api';
    mockSend.mockRejectedValueOnce(new Error('AccessDenied to CloudWatch'));

    const res = await request
      .get('/api/admin/aws-metrics')
      .set('Authorization', 'Bearer admin-token');

    expect(res.status).toBe(500);
    expect(res.body.error).toContain(
      'Failed to fetch CloudWatch metrics: AccessDenied to CloudWatch'
    );
  });
});
