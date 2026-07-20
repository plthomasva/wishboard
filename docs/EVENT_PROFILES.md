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

## 4. Alternative Turso Databases

To point a deployment stack to an isolated database:

```bash
DATABASE_URL="libsql://wishboard-conf-yourorg.turso.io" \
DATABASE_AUTH_TOKEN_SSM="/wishboard/conf/turso-auth-token" \
npx wishboard serverless deploy \
  --stack-name conf-wishboard \
  --event-profile professional \
  --domain conference.wishboards.app \
  --cert-domain wishboards.app
```
