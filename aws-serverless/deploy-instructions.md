# Deploying Wishboard to AWS Serverless

This guide details how to build, deploy, maintain, and estimate the monthly costs of running Wishboard as a serverless application on AWS.

---

## AWS Monthly Cost & Pricing Analysis

Here is a monthly cost breakdown for a moderate-use environment (e.g., 5,000 active monthly users, 10,000 API requests, and 1 GB of image uploads):

| Service | Estimated Monthly Usage | Free Tier Covered? | Estimated Monthly Cost |
| :--- | :--- | :--- | :--- |
| **Amazon CloudFront** | 10,000 HTTP requests, <10 GB egress data | Yes (covered by permanent 1 TB egress / 10M requests) | **$0.00** |
| **Amazon S3** | 1 GB storage, 10,000 GETs, 1,000 PUTs | Yes (covered by 5 GB / 20k GET / 2k PUT Free Tier) | **$0.00** (or **$0.03** post-Free Tier) |
| **AWS Lambda** | 10,000 invocations (avg. 500ms execution, 512MB RAM) | Yes (covered by permanent 1M requests / 400k GB-sec) | **$0.00** |
| **Amazon API Gateway** | 10,000 HTTP API requests, 1,000 WebSocket connections | HTTP API: $0.01. WebSockets: $0.01. | **$0.02** |
| **Amazon EFS** | 1 GB database storage, low throughput | Yes (covered by 5 GB EFS Standard Free Tier) | **$0.00** (or **$0.30** post-Free Tier) |
| **VPC Networking** | Private subnet traffic (EFS + S3 Gateway Endpoint) | **Zero-NAT Optimization**: Routed via S3 Gateway VPC Endpoint. No NAT Gateway needed. | **$0.00** |
| **Route 53 & ACM** | 1 Hosted Zone, 1 ACM certificate, low DNS queries | ACM: Free. Route 53 Hosted Zone: $0.50. | **$0.50** |
| **Total (Free Tier)** | | | **$0.52 / month** |
| **Total (Post-Free Tier)** | | | **$0.85 / month** |

> [!TIP]
> **Zero-NAT Cost Optimization:**
> Normally, AWS Lambda functions inside a VPC require a NAT Gateway ($32.40/month base charge) to connect to S3 or external APIs. 
> To bypass this cost, we configure an **S3 Gateway VPC Endpoint** (which is completely free) inside our private subnets. Because the Express API only reads/writes to EFS SQLite and uploads images to S3, it doesn't need public internet access at runtime, allowing our VPC configuration to cost exactly **$0.00**!

---

## Prerequisites

Before starting, make sure you have the following installed and configured on your machine:

1. **AWS CLI** (configured with admin credentials to your AWS account).
2. **AWS SAM CLI** (Serverless Application Model CLI) to build and deploy.
3. **Node.js** (v22+) and **npm**.
4. **Vite** (already configured in the project).
5. **Route 53 Hosted Zone ID** (Optional, if you wish to use a custom domain).

---

## Quick Deploy (Scripted)

The fastest path is the bundled deploy scripts, which run every step below in
order (frontend build → `sam build` → native-binary post-build → `sam deploy` →
S3 upload → CloudFront invalidation). The first run with no `samconfig.toml` (or
with `--guided`/`-Guided`) walks you through the interactive SAM configuration;
subsequent runs reuse it.

```bash
# macOS / Linux / Git Bash
./scripts/deploy-serverless.sh --profile wishboard      # or omit --profile for default creds
```

```powershell
# Windows PowerShell
./scripts/deploy-serverless.ps1 -Profile wishboard      # or omit -Profile for default creds
```

Useful flags: `--guided`/`-Guided` (force first-time config), `--mode`/`-Mode`
(deploy as `prod` or `dev`), `--frontend-only`/`-FrontendOnly`
(rebuild + reupload the UI without touching the backend), `--stack-name`/`--region`.

To run the steps manually instead, follow the sections below.

## Deployment Steps

### 1. Build the Frontend
Compile the React frontend static assets:
```bash
npm run build
```
This output is saved to the `./dist` directory.

### 2. Build the Serverless Backend
We use AWS SAM's native `esbuild` support to bundle the backend Express code and the WebSocket manager:
```bash
cd aws-serverless
sam build
```

Then copy the libSQL native binary into the build artifacts. esbuild bundles the
JavaScript layer of `@libsql/client`, but the native `.node` binding cannot be
bundled, so it must be added to the artifact after `sam build`. Skipping this
step makes every API call fail with HTTP 500 (`Cannot find module
'@libsql/linux-x64-gnu'`):
```bash
node post-build.js
```

### 3. Deploy the Stack
Deploy the resources to your AWS account. If deploying a custom domain, we recommend deploying this stack in the **us-east-1** (N. Virginia) region so ACM can automatically provision the SSL/TLS certificate:
```bash
sam deploy --guided
```
SAM will prompt you for the following parameters:
- **Stack Name**: `wishboard-serverless`
- **AWS Region**: `us-east-1` (highly recommended for custom domains)
- **DomainName**: Your custom domain (e.g. `wishboard.yourdomain.com`). Leave empty to use the default CloudFront URL.
- **HostedZoneId**: The Route 53 Hosted Zone ID for domain verification. Leave empty if not using a custom domain.
- **AcmCertificateArn**: If you already have an SSL certificate in `us-east-1`, paste its ARN here.

Once deployment finishes, it will print the S3 bucket names and the CloudFront URL in the command output (e.g., `FrontendBucketName` and `CloudFrontUrl`).

### 4. Upload Frontend Assets to S3
Upload the built React frontend files to the S3 bucket:
```bash
aws s3 sync ../dist s3://<Your-Frontend-Bucket-Name> --delete
```
*(Replace `<Your-Frontend-Bucket-Name>` with the value printed in the CloudFormation output).*

---

## Maintenance & Updates

### Updating the Backend (Express API / WebSockets)
If you modify any files in `src/server/*`:
1. Re-build the stack:
   ```bash
   sam build
   ```
2. Deploy the updates:
   ```bash
   sam deploy
   ```

### Updating the Frontend (React UI)
If you modify any frontend files:
1. Re-build the static assets:
   ```bash
   npm run build
   ```
2. Upload the updated files to S3:
   ```bash
   aws s3 sync ../dist s3://<Your-Frontend-Bucket-Name> --delete
   ```
3. Invalidate the CloudFront cache to make the changes live immediately:
   ```bash
   aws cloudfront create-invalidation --distribution-id <Your-CloudFront-Distribution-Id> --paths "/*"
   ```

---

## Accessing the Application
- Access your board at the custom domain URL (if configured) or the default CloudFront URL (e.g. `https://dxxxxxxxxxxxxx.cloudfront.net`).
- File uploads are securely and automatically uploaded to S3 and served directly via CloudFront at `/images/*`.
- WebSockets operate seamlessly at `/socket.io/*` using API Gateway WebSockets, with connection states persisted automatically inside the SQLite database on EFS.
