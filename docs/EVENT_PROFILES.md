# Event Profiles and Deployment Guide in Wishboard

The Wishboard project supports deploying customized event profiles (such as a professional conference or a lifestyle convention) across local kiosks or serverless AWS stacks.

## 1. Event Profiles

Profiles live in the `/profiles/` directory:

- `lifestyle`: Features lifestyle identities, sticker badges, and FetLife / Phone / Email contact methods.
- `professional`: Features conference roles, goal cross-matching rules (Hiring <-> Job Seeking), and LinkedIn / Phone / Email contact methods.

### Selecting a Profile during Deployment

To specify an event profile, use the `--event-profile` flag:

```bash
# Serverless deployment for a professional conference
npx wishboard serverless deploy --stack-name conf-wishboard --event-profile professional

# Kiosk deployment for a professional conference
npx wishboard kiosk deploy --event-profile professional
```

If `--event-profile` points to a non-existent profile name, the deployment script aborts with an error before making changes.

## 2. Deploying to Different Stacks

To deploy an isolated instance of Wishboard on AWS, assign it a unique CloudFormation stack name:

```bash
npx wishboard serverless deploy --stack-name conf-wishboard --event-profile professional
```

Each unique stack name creates an isolated set of AWS resources (Lambda functions, API Gateway, S3 buckets, and CloudFront distributions).

## 3. Configuring Domains and Wildcard Certificates

You can override the custom domain using `--domain` and `--cert-domain`:

```bash
npx wishboard serverless deploy \
  --stack-name conf-wishboard \
  --event-profile professional \
  --domain conference.wishboards.app \
  --cert-domain wishboards.app
```

## 4. Environment Profiles in SAM Config (`samconfig.toml`)

AWS SAM configuration (`aws-serverless/samconfig.toml`) supports section-based environment profiles (e.g. `default`, `lifestyle`, `professional`).

Profile parameters inherit from `default.deploy.parameters` or `default.global.parameters`, so environment-specific sections only need to override profile-specific parameters (such as `stack_name`, `parameter_overrides` for `DomainName`, `DatabaseUrl`, and `DatabaseAuthTokenSsm`):

```toml
[default.deploy.parameters]
stack_name = "wishboard-serverless-dev"
region = "us-east-1"
profile = "wishboard"

[lifestyle.deploy.parameters]
parameter_overrides = 'ProjectName="wishboard-serverless" DomainName="lifestyle.wishboards.app" HostedZoneId="Z0123456789ABCDEF" DatabaseUrl="libsql://wishboard-dev.turso.io" DatabaseAuthTokenSsm="/wishboard/dev/turso-auth-token"'

[professional.deploy.parameters]
stack_name = "wishboard-serverless-conference-dev"
parameter_overrides = 'ProjectName="wishboard-serverless" DomainName="conference.wishboards.app" HostedZoneId="Z0123456789ABCDEF" DatabaseUrl="libsql://conference-dev.turso.io" DatabaseAuthTokenSsm="/wishboard/conf/turso-auth-token"'
```

When deploying with `--event-profile <name>` (or `--config-env <name>`), the CLI automatically:

- Passes `--config-env <name>` to `sam deploy`.
- Resolves stack configurations, parameter overrides, and region defaults from the matching `samconfig.toml` profile section with fallback to `default`.
- Reuses the ACM SSL Certificate created by the primary stack when a wildcard or apex domain certificate is present.

## 5. Alternative Turso Databases & SSM Token Seeding

To point a serverless deployment stack to an isolated database:

1. **Seed the auth token into AWS SSM Parameter Store** as a `SecureString`:
   ```bash
   npx wishboard db set-ssm-token /wishboard/conf/turso-auth-token "your-turso-jwt-token" --region us-east-1
   ```
2. **Deploy the serverless stack with the custom database variables**:
   ```bash
   DATABASE_URL="libsql://wishboard-conf-yourorg.turso.io" \
   DATABASE_AUTH_TOKEN_SSM="/wishboard/conf/turso-auth-token" \
   npx wishboard serverless deploy \
     --stack-name conf-wishboard \
     --event-profile professional \
     --domain conference.wishboards.app \
     --cert-domain wishboards.app
   ```

## 5. Kiosk Database Architecture

For local Raspberry Pi kiosk deployments (`npx wishboard kiosk deploy`), Wishboard runs an embedded libSQL server in a Docker container on the Pi (`DATABASE_URL=http://db:8080` inside the compose network, with SQLite files stored at `./data/db`). No remote authentication token or SSM parameter is required for standard kiosk deployments.

To connect a kiosk to a remote database instead, specify `DATABASE_URL` and `DATABASE_AUTH_TOKEN` in `$WISHBOARD_HOME/wishboard/.env` on the Pi prior to starting the service.
