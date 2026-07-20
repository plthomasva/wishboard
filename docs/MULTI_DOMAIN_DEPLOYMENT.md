# Multi-Domain Deployments in Wishboard

The Wishboard project supports deploying multiple independent environments (such as a demo site and a specific conference instance) within the same AWS account using the `wishboard serverless deploy` command.

This guide explains how to manage multiple deployments, configure wildcard certificates, and use alternative Turso databases.

## 1. Deploying to Different Stacks

To deploy an isolated instance of Wishboard, you need to assign it a unique CloudFormation stack name.
You can override the default stack name configured in `samconfig.toml` by passing the `--stack-name` flag:

```bash
node src/cli/wishboard.js serverless deploy --stack-name conf-wishboard
```

Each unique stack name creates a completely isolated set of AWS resources (Lambda functions, API Gateway, S3 buckets, and CloudFront distributions).

## 2. Configuring Domains and Wildcard Certificates

By default, the serverless deployment uses the domain specified in `samconfig.toml` (or `DOMAIN_NAME` env var).
When deploying an alternate instance, you'll likely want to host it on a subdomain (e.g., `conference.wishboards.app`).

You can override the domain using the `--domain` flag.

### Wildcard Certificates

To simplify SSL/TLS certificate management across multiple subdomains, you can request an AWS ACM Wildcard Certificate using the `--cert-domain` flag.

```bash
node src/cli/wishboard.js serverless deploy \
  --stack-name conf-wishboard \
  --domain conference.wishboards.app \
  --cert-domain wishboards.app
```

**What this does:**

1. It requests an ACM certificate where the primary `DomainName` is `wishboards.app` and it attaches `*.wishboards.app` as a Subject Alternative Name (SAN).
2. It attaches this wildcard certificate to the CloudFront distribution for the `conference.wishboards.app` deployment.
3. This wildcard certificate can then be re-used for other subdomains (like `demo.wishboards.app`) without requiring additional DNS validation.

## 3. Alternative Turso Databases

A different deployment stack (e.g., `conference`) should point to a different database to keep the data isolated from the `demo` or `production` environments.

To configure an alternate database:

1. Create a new Turso database (e.g., `turso db create wishboard-conf`).
2. Generate an auth token for the new database (`turso db tokens create wishboard-conf`).
3. Store the token in AWS Systems Manager (SSM) Parameter Store in `us-east-1` under a new secure string parameter (e.g., `/wishboard/conf/turso-auth-token`).
4. During deployment, provide the new Database URL and SSM parameter name:

```bash
DATABASE_URL="libsql://wishboard-conf-yourorg.turso.io" \
DATABASE_AUTH_TOKEN_SSM="/wishboard/conf/turso-auth-token" \
node src/cli/wishboard.js serverless deploy \
  --stack-name conf-wishboard \
  --domain conference.wishboards.app \
  --cert-domain wishboards.app
```

## 4. Kiosk Deployments

If you are running the Raspberry Pi kiosk and wish to point it to an alternative implementation or domain, the kiosk commands also support the `--domain` override.

```bash
node src/cli/wishboard.js kiosk deploy --domain conference.wishboards.app
```

This will ensure the kiosk UI configures itself to expect the correct rule definitions and API endpoints.
