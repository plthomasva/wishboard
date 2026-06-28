#!/usr/bin/env bash
#
# Set up GitHub Actions OIDC Authentication with AWS and configure repo secrets.
#
# Requirements:
#   - AWS CLI (logged in with administrative permissions)
#   - GitHub CLI (gh) (optional, used to automatically configure secrets/variables)
#   - Git CLI
#
# Usage:
#   ./scripts/setup-oidc.sh [--org <org>] [--repo <repo>] [--region <region>]

set -euo pipefail

# Colors
C_CYAN='\033[1;36m'; C_GREEN='\033[1;32m'; C_YELLOW='\033[1;33m'; C_RED='\033[1;31m'; C_RESET='\033[0m'
step() { echo -e "${C_CYAN}==>${C_RESET} $1"; }
info() { echo -e "    $1"; }
warn() { echo -e "${C_YELLOW}WARNING:${C_RESET} $1"; }
error() { echo -e "${C_RED}ERROR:${C_RESET} $1"; }

ORG=""
REPO=""
REGION="us-east-1"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --org)    ORG="$2"; shift 2 ;;
        --repo)   REPO="$2"; shift 2 ;;
        --region) REGION="$2"; shift 2 ;;
        -h|--help)
            echo "Usage: $0 [--org <org>] [--repo <repo>] [--region <region>]"
            exit 0
            ;;
        *) echo "Unknown option: $1" >&2; exit 1 ;;
    esac
done

# Resolve Git remote repo information if not specified
if [[ -z "$ORG" || -z "$REPO" ]]; then
    step "Detecting GitHub repository info from Git remote..."
    GIT_URL=$(git remote get-url origin 2>/dev/null || echo "")
    if [[ "$GIT_URL" =~ github.com[:/]([^/]+)/([^/.]+)(\.git)? ]]; then
        DETECTED_ORG="${BASH_REMATCH[1]}"
        DETECTED_REPO="${BASH_REMATCH[2]}"
        ORG="${ORG:-$DETECTED_ORG}"
        REPO="${REPO:-$DETECTED_REPO}"
        info "Detected GitHub repository: ${ORG}/${REPO}"
    else
        ORG="${ORG:-plthomasva}"
        REPO="${REPO:-wishboard}"
        warn "Could not detect GitHub repository from Git remote. Defaulting to ${ORG}/${REPO}"
    fi
fi

# Preflight checks
step "Performing preflight checks..."
if ! command -v aws >/dev/null 2>&1; then
    error "AWS CLI not found. Please install the AWS CLI."
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null) || {
    error "Unable to authenticate to AWS. Please run 'aws configure' or log in first."
    exit 1
}
info "Authenticated to AWS Account: ${ACCOUNT_ID}"
info "Target Deployment Region: ${REGION}"

# Check for existing OIDC provider in IAM to avoid duplicate error
step "Checking for existing GitHub OIDC Provider in AWS account..."
OIDC_ARN=$(aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[?contains(Arn, 'token.actions.githubusercontent.com')].Arn | [0]" --output text 2>/dev/null || echo "")
OIDC_ARN=$(echo "$OIDC_ARN" | tr -d '\r')
if [[ "$OIDC_ARN" == "None" || -z "$OIDC_ARN" ]]; then
    OIDC_ARN=""
    info "No existing GitHub OIDC provider found. It will be created."
else
    info "Found existing GitHub OIDC provider: ${OIDC_ARN}"
fi

# Deploy OIDC setup stack
STACK_NAME="${REPO}-github-oidc-setup"
step "Deploying CloudFormation stack: ${STACK_NAME}..."
aws cloudformation deploy \
    --template-file aws-serverless/github-oidc-role.yaml \
    --stack-name "$STACK_NAME" \
    --parameter-overrides \
        GitHubOrg="$ORG" \
        GitHubRepo="$REPO" \
        OidcProviderArn="$OIDC_ARN" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$REGION"

# Extract Role ARN
step "Retrieving Role ARN output..."
ROLE_ARN=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='RoleArn'].OutputValue" \
    --output text \
    --region "$REGION")

info "Deployment Role Created Successfully!"
echo -e "${C_GREEN}Role ARN: ${ROLE_ARN}${C_RESET}"
echo ""

# Configure GitHub Secrets/Variables
step "Configuring GitHub Repository settings..."
GH_CONFIGURED=false

if command -v gh >/dev/null 2>&1; then
    if gh auth status >/dev/null 2>&1; then
        info "GitHub CLI (gh) detected and authenticated. Configuring repository settings..."
        
        # Set Secret
        if gh secret set AWS_ROLE_TO_ASSUME --body "$ROLE_ARN"; then
            info "Set secret: AWS_ROLE_TO_ASSUME"
        else
            warn "Failed to set secret AWS_ROLE_TO_ASSUME via GitHub CLI."
        fi

        # Set Variables
        if gh variable set AWS_REGION --body "$REGION" 2>/dev/null || gh variable set AWS_REGION -b "$REGION"; then
            info "Set variable: AWS_REGION = ${REGION}"
        else
            warn "Failed to set variable AWS_REGION."
        fi

        if gh variable set AWS_STACK_NAME --body "${REPO}-serverless-dev" 2>/dev/null || gh variable set AWS_STACK_NAME -b "${REPO}-serverless-dev"; then
            info "Set variable: AWS_STACK_NAME = ${REPO}-serverless-dev"
        else
            warn "Failed to set variable AWS_STACK_NAME."
        fi
        
        GH_CONFIGURED=true
    else
        warn "GitHub CLI (gh) is installed but not authenticated. Run 'gh auth login' to authenticate."
    fi
else
    info "GitHub CLI (gh) not detected."
fi

if ! $GH_CONFIGURED; then
    echo -e "${C_YELLOW}Please manually set the following in your GitHub Repository settings (Settings -> Secrets and variables -> Actions):${C_RESET}"
    echo ""
    echo -e "  ${C_GREEN}Repository Secrets:${C_RESET}"
    echo -e "    Name:  ${C_CYAN}AWS_ROLE_TO_ASSUME${C_RESET}"
    echo -e "    Value: ${ROLE_ARN}"
    echo ""
    echo -e "  ${C_GREEN}Repository Variables:${C_RESET}"
    echo -e "    Name:  ${C_CYAN}AWS_REGION${C_RESET}"
    echo -e "    Value: ${REGION}"
    echo -e "    Name:  ${C_CYAN}AWS_STACK_NAME${C_RESET}"
    echo -e "    Value: ${REPO}-serverless-dev"
    echo ""
fi

echo -e "${C_GREEN}OIDC Setup Complete!${C_RESET}"
