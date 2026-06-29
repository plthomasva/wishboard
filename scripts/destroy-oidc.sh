#!/usr/bin/env bash
# Tears down the GitHub Actions OIDC Authentication stack and cleans up repo secrets.

set -e

ORG=""
REPO=""
REGION="us-east-1"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --org) ORG="$2"; shift ;;
        --repo) REPO="$2"; shift ;;
        --region) REGION="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

if [[ -z "$ORG" ]] || [[ -z "$REPO" ]]; then
    GIT_URL=$(git remote get-url origin 2>/dev/null || true)
    if [[ "$GIT_URL" =~ github\.com[:/]([^/]+)/([^/\.]+)(\.git)? ]]; then
        [[ -z "$ORG" ]] && ORG="${BASH_REMATCH[1]}"
        [[ -z "$REPO" ]] && REPO="${BASH_REMATCH[2]}"
    fi
    [[ -z "$ORG" ]] && ORG="plthomasva"
    [[ -z "$REPO" ]] && REPO="wishboard"
fi

STACK_NAME="${REPO}-github-oidc-setup"

echo "==> Deleting CloudFormation stack: $STACK_NAME..."
aws cloudformation delete-stack --stack-name "$STACK_NAME" --region "$REGION"
aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME" --region "$REGION"
echo "    Stack deleted successfully."

echo "==> Cleaning up GitHub Repository settings..."
if command -v gh &> /dev/null; then
    if gh auth status &>/dev/null; then
        gh secret delete AWS_ROLE_TO_ASSUME &>/dev/null || true
        echo "    Deleted secret: AWS_ROLE_TO_ASSUME"
        
        gh variable delete AWS_REGION &>/dev/null || true
        echo "    Deleted variable: AWS_REGION"
        
        gh variable delete AWS_STACK_NAME &>/dev/null || true
        echo "    Deleted variable: AWS_STACK_NAME"
    else
        echo "WARNING: GitHub CLI (gh) is installed but not authenticated. Skipping secrets cleanup."
    fi
else
    echo "    GitHub CLI (gh) not detected. Please manually remove AWS_ROLE_TO_ASSUME, AWS_REGION, and AWS_STACK_NAME from your GitHub repo settings."
fi

echo -e "\033[32mOIDC Teardown Complete!\033[0m"
