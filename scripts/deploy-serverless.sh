#!/usr/bin/env bash
#
# Build and deploy (or update) the Wishboard AWS serverless stack.
#
# Performs every step required to deploy the serverless target:
#   1. Builds the React frontend (vite -> dist/)
#   2. Bundles the backend with `sam build`
#   3. Copies the libSQL native binary into the build artifacts (post-build.js)
#   4. Deploys the CloudFormation stack with `sam deploy`
#      (guided on first run / when no samconfig.toml exists, otherwise reuses it)
#   5. Uploads the built frontend assets to the S3 frontend bucket
#   6. Invalidates the CloudFront cache
#
# AWS credentials are resolved the standard way. Pass --profile to use a named
# profile (e.g. a dedicated Wishboard account); omit it to use your default
# credentials / environment variables.
#
# Usage:
#   ./scripts/deploy-serverless.sh [options]
#
# Options:
#   --profile <name>        AWS CLI profile (falls back to samconfig.toml, then default creds)
#   --stack-name <name>     CloudFormation stack name (default: from samconfig.toml or wishboard-serverless)
#   --region <region>       AWS region (falls back to samconfig.toml, then AWS config)
#   --mode <mode>           Deployment mode: prod or dev (default: prod)
#   --guided                Force `sam deploy --guided` (interactive first-time setup)
#   --frontend-only         Only rebuild + upload the frontend; skip the backend deploy
#   --skip-frontend-upload  Deploy the backend only; skip S3 upload + CloudFront invalidation
#   -h, --help              Show this help
#
# Examples:
#   ./scripts/deploy-serverless.sh --profile wishboard
#   ./scripts/deploy-serverless.sh                 # default AWS credentials
#   ./scripts/deploy-serverless.sh --guided        # first-time interactive setup
#   ./scripts/deploy-serverless.sh --profile wishboard --frontend-only

set -euo pipefail

PROFILE=""
STACK_NAME=""
REGION=""
MODE="prod"
GUIDED=false
FRONTEND_ONLY=false
SKIP_FRONTEND_UPLOAD=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --profile)              PROFILE="$2"; shift 2 ;;
        --stack-name)           STACK_NAME="$2"; shift 2 ;;
        --region)               REGION="$2"; shift 2 ;;
        --mode)                 MODE="$2"; shift 2 ;;
        --guided)               GUIDED=true; shift ;;
        --frontend-only)        FRONTEND_ONLY=true; shift ;;
        --skip-frontend-upload) SKIP_FRONTEND_UPLOAD=true; shift ;;
        -h|--help)              grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

if [[ "$MODE" != "prod" && "$MODE" != "dev" ]]; then
    echo "Invalid mode: $MODE. Must be prod or dev." >&2
    exit 1
fi

# Colors
C_CYAN='\033[1;36m'; C_GREEN='\033[1;32m'; C_GRAY='\033[0;90m'; C_RESET='\033[0m'
step() { local msg="$1"; echo -e "${C_CYAN}==> $msg${C_RESET}"; }
info() { local msg="$1"; echo -e "${C_GRAY}    $msg${C_RESET}"; }

# Resolve project paths
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVERLESS_DIR="${PROJECT_ROOT}/aws-serverless"
SAM_CONFIG="${SERVERLESS_DIR}/samconfig.toml"
DIST_DIR="${PROJECT_ROOT}/dist"

require_command() {
    local cmd="$1"
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "Required command '$cmd' was not found in PATH. Please install it and retry." >&2
        exit 1
    fi
}

# Read a value (e.g. stack_name, region, profile) from samconfig.toml.
toml_value() {
    local key="$1"
    [[ -f "$SAM_CONFIG" ]] || return 0
    grep -E "^[[:space:]]*${key}[[:space:]]*=" "$SAM_CONFIG" | head -1 \
        | sed -E "s/^[^=]*=[[:space:]]*//; s/^\"//; s/\"[[:space:]]*$//"
}

# Extract a key's value from a space-separated Key="Value" string.
extract_override() {
    local key="$1"
    local overrides="$2"
    echo "$overrides" | sed -nE "s/.*${key}=\"([^\"]*)\".*/\1/p"
}

# --- Resolve configuration (CLI args win, then samconfig.toml, then defaults) ---
[[ -n "$STACK_NAME" ]] || STACK_NAME="$(toml_value stack_name)"
[[ -n "$STACK_NAME" ]] || STACK_NAME="wishboard-serverless"
[[ -n "$REGION" ]]     || REGION="$(toml_value region)"
[[ -n "$PROFILE" ]]    || PROFILE="$(toml_value profile)"

# Build the common --profile / --region args shared by sam and aws.
AWS_COMMON=()
rebuild_aws_common() {
    AWS_COMMON=()
    if [[ -n "$PROFILE" ]]; then AWS_COMMON+=(--profile "$PROFILE"); fi
    if [[ -n "$REGION" ]];  then AWS_COMMON+=(--region "$REGION"); fi
}
rebuild_aws_common

echo ""
echo -e "${C_GREEN}Wishboard serverless deployment${C_RESET}"
info "Stack:   ${STACK_NAME}"
info "Profile: ${PROFILE:-(default credentials)}"
info "Region:  ${REGION:-(from AWS config)}"
echo ""

# --- Preflight ---
step "Checking prerequisites..."
require_command node
require_command npm
require_command aws
$FRONTEND_ONLY || require_command sam

ACCOUNT="$(aws sts get-caller-identity "${AWS_COMMON[@]}" --query Account --output text)" || {
    echo "Unable to authenticate to AWS. Check your credentials / --profile value." >&2
    exit 1
}
if [[ -z "$ACCOUNT" || "$ACCOUNT" == "None" ]]; then
    echo "Unable to authenticate to AWS. Check your credentials / --profile value." >&2
    exit 1
fi
info "Authenticated to AWS account ${ACCOUNT}"

# --- 1. Frontend build ---
step "[1/6] Building frontend (npm run build)..."
( cd "$PROJECT_ROOT" && npm run build )

if ! $FRONTEND_ONLY; then
    # --- 2. Backend bundle ---
    step "[2/6] Bundling backend (sam build)..."
    ( cd "$SERVERLESS_DIR" && sam build )

    # --- 3. Native binary post-build ---
    step "[3/6] Copying libSQL native binary into artifacts (post-build.js)..."
    ( cd "$SERVERLESS_DIR" && node post-build.js )

    # --- 4. Deploy stack ---
    USE_GUIDED=false
    if $GUIDED || [[ ! -f "$SAM_CONFIG" ]]; then USE_GUIDED=true; fi

    DEPLOY_ARGS=(deploy --stack-name "$STACK_NAME")
    MAX_DEPLOY_ATTEMPTS=4
    if $USE_GUIDED; then
        step "[4/6] Deploying stack (sam deploy --guided)..."
        info "No samconfig.toml found or --guided specified; starting interactive setup."
        DEPLOY_ARGS+=(--guided)
        MAX_DEPLOY_ATTEMPTS=1   # interactive; don't auto-retry
    else
        step "[4/6] Deploying stack (sam deploy)..."
        DEPLOY_ARGS+=(--no-confirm-changeset --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM)
    fi
    DEPLOY_ARGS+=("${AWS_COMMON[@]}")

    NODE_ENV_VAL="production"
    if [[ "$MODE" == "dev" ]]; then NODE_ENV_VAL="development"; fi

    TOML_OVERRIDES="$(toml_value parameter_overrides)"
    PROJECT_NAME="${PROJECT_NAME:-$(extract_override ProjectName "$TOML_OVERRIDES")}"
    [[ -n "$PROJECT_NAME" ]] || PROJECT_NAME="wishboard"

    DOMAIN_NAME="${DOMAIN_NAME:-$(extract_override DomainName "$TOML_OVERRIDES")}"
    HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-$(extract_override HostedZoneId "$TOML_OVERRIDES")}"
    ACM_CERTIFICATE_ARN="${ACM_CERTIFICATE_ARN:-$(extract_override AcmCertificateArn "$TOML_OVERRIDES")}"

    MERGED_OVERRIDES="ProjectName=\"${PROJECT_NAME}\" DomainName=\"${DOMAIN_NAME}\" HostedZoneId=\"${HOSTED_ZONE_ID}\" AcmCertificateArn=\"${ACM_CERTIFICATE_ARN}\" NodeEnv=\"${NODE_ENV_VAL}\""
    DEPLOY_ARGS+=(--parameter-overrides "$MERGED_OVERRIDES")

    # Let boto retry transient S3/network errors while uploading artifacts.
    export AWS_MAX_ATTEMPTS=6
    export AWS_RETRY_MODE=adaptive

    # Outer retry: artifact uploads to the managed bucket can drop the connection
    # mid-stream on flaky networks. Re-running sam deploy is idempotent
    # (already-uploaded artifacts are skipped).
    attempt=1
    while true; do
        if ( cd "$SERVERLESS_DIR" && sam "${DEPLOY_ARGS[@]}" ); then
            break
        fi
        if [[ $attempt -ge $MAX_DEPLOY_ATTEMPTS ]]; then
            echo "sam deploy failed after ${attempt} attempt(s)." >&2
            exit 1
        fi
        info "sam deploy attempt ${attempt} failed; likely a transient upload error. Retrying in 5s..."
        sleep 5
        attempt=$((attempt + 1))
    done

    # Guided mode may have just written/updated samconfig.toml; pick up the
    # values the user chose so the output lookups below use them.
    [[ -n "$REGION" ]]  || REGION="$(toml_value region)"
    [[ -n "$PROFILE" ]] || PROFILE="$(toml_value profile)"
    TOML_STACK="$(toml_value stack_name)"
    [[ -n "$TOML_STACK" ]] && STACK_NAME="$TOML_STACK"
    rebuild_aws_common
fi

# --- 5. Read stack outputs ---
step "[5/6] Reading stack outputs..."
stack_output() {
    local key="$1" value
    value="$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" "${AWS_COMMON[@]}" \
        --query "Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue | [0]" --output text)"
    [[ "$value" == "None" ]] && value=""
    echo "$value"
}
FRONTEND_BUCKET="$(stack_output FrontendBucketName)"
DIST_ID="$(stack_output CloudFrontDistributionId)"
CF_URL="$(stack_output CloudFrontUrl)"
CUSTOM_URL="$(stack_output CustomDomainUrl)"

if [[ -z "$FRONTEND_BUCKET" ]]; then
    echo "FrontendBucketName output not found. Did the stack deploy successfully?" >&2
    exit 1
fi
info "Frontend bucket: ${FRONTEND_BUCKET}"

if [[ -n "$DIST_ID" ]]; then
    step "Configuring CloudFront ID on ApiFunction environment variables..."
    LAMBDA_NAME="$(aws cloudformation describe-stack-resource --stack-name "$STACK_NAME" --logical-resource-id "ApiFunction" "${AWS_COMMON[@]}" --query "StackResourceDetail.PhysicalResourceId" --output text 2>/dev/null || echo "")"
    if [[ -n "$LAMBDA_NAME" && "$LAMBDA_NAME" != "None" ]]; then
        CONFIG_JSON="$(aws lambda get-function-configuration --function-name "$LAMBDA_NAME" "${AWS_COMMON[@]}" 2>/dev/null || echo "")"
        if [[ -n "$CONFIG_JSON" ]]; then
            NEW_ENV_JSON="$(node -e "
                try {
                    const config = $CONFIG_JSON;
                    const vars = config.Environment?.Variables || {};
                    if (vars.CLOUDFRONT_DISTRIBUTION_ID !== '$DIST_ID') {
                        vars.CLOUDFRONT_DISTRIBUTION_ID = '$DIST_ID';
                        console.log(JSON.stringify({ Variables: vars }));
                    }
                } catch (e) {}
            ")"
            if [[ -n "$NEW_ENV_JSON" ]]; then
                aws lambda update-function-configuration --function-name "$LAMBDA_NAME" --environment "$NEW_ENV_JSON" "${AWS_COMMON[@]}" >/dev/null
                info "Successfully configured CLOUDFRONT_DISTRIBUTION_ID=$DIST_ID on $LAMBDA_NAME"
            else
                info "CLOUDFRONT_DISTRIBUTION_ID is already up to date ($DIST_ID)"
            fi
        else
            info "Warning: Could not dynamically set CLOUDFRONT_DISTRIBUTION_ID: Failed to fetch Lambda configuration"
        fi
    else
        info "Warning: Could not dynamically set CLOUDFRONT_DISTRIBUTION_ID: Failed to resolve ApiFunction physical resource ID"
    fi
fi

# --- 6. Upload frontend + invalidate CloudFront ---
if $SKIP_FRONTEND_UPLOAD; then
    step "[6/6] Skipping frontend upload (--skip-frontend-upload)."
else
    [[ -d "$DIST_DIR" ]] || { echo "Build output not found at ${DIST_DIR}." >&2; exit 1; }

    step "[6/6] Uploading frontend to s3://${FRONTEND_BUCKET} ..."
    aws s3 sync "$DIST_DIR" "s3://${FRONTEND_BUCKET}" --delete "${AWS_COMMON[@]}"

    if [[ -n "$DIST_ID" ]]; then
        info "Invalidating CloudFront cache (${DIST_ID})..."
        aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" "${AWS_COMMON[@]}" >/dev/null
    fi
fi

echo ""
echo -e "${C_GREEN}Deployment complete!${C_RESET}"
[[ -n "$CF_URL" ]]     && echo -e "${C_GREEN}  CloudFront URL: ${CF_URL}${C_RESET}"
[[ -n "$CUSTOM_URL" ]] && echo -e "${C_GREEN}  Custom domain:  ${CUSTOM_URL}${C_RESET}"
echo ""
