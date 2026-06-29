#!/usr/bin/env bash
# Tears down the Wishboard AWS serverless stack cleanly.
# Checks for S3 buckets created by the stack and empties them, then
# deletes the CloudFormation stack via `sam delete`.

set -e

FORCE=false
AWS_PROFILE=""
REGION=""
STACK_NAME=""

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --profile) AWS_PROFILE="$2"; shift ;;
        --region) REGION="$2"; shift ;;
        --stack-name) STACK_NAME="$2"; shift ;;
        --force|-f) FORCE=true ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SAM_CONFIG="$PROJECT_ROOT/aws-serverless/samconfig.toml"

get_toml_value() {
    local key=$1
    if [[ -f "$SAM_CONFIG" ]]; then
        grep -E "^\s*${key}\s*=" "$SAM_CONFIG" | head -n 1 | sed -E "s/^\s*${key}\s*=\s*\"?([^\"]*)\"?\s*$/\1/"
    fi
}

[[ -z "$STACK_NAME" ]] && STACK_NAME=$(get_toml_value "stack_name")
[[ -z "$STACK_NAME" ]] && STACK_NAME="wishboard-serverless"
[[ -z "$REGION" ]] && REGION=$(get_toml_value "region")
[[ -z "$AWS_PROFILE" ]] && AWS_PROFILE=$(get_toml_value "profile")

AWS_CMD="aws"
SAM_CMD="sam"

if [[ -n "$AWS_PROFILE" ]]; then
    AWS_CMD="$AWS_CMD --profile $AWS_PROFILE"
    SAM_CMD="$SAM_CMD --profile $AWS_PROFILE"
fi
if [[ -n "$REGION" ]]; then
    AWS_CMD="$AWS_CMD --region $REGION"
    SAM_CMD="$SAM_CMD --region $REGION"
fi

if [[ ! "$STACK_NAME" =~ "dev" ]] && [[ "$FORCE" != "true" ]]; then
    echo "ERROR: Attempting to delete a production stack '$STACK_NAME'. You must supply the --force flag to acknowledge deletion of all images and databases."
    exit 1
fi

echo "==> Checking for existing stack '$STACK_NAME'..."
STACK_STATUS=$($AWS_CMD cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].StackStatus" --output text 2>/dev/null || true)

if [[ -z "$STACK_STATUS" ]] || [[ "$STACK_STATUS" == "None" ]]; then
    echo "    Stack '$STACK_NAME' does not exist or is already deleted."
    exit 0
fi

echo "==> Emptying S3 buckets for stack '$STACK_NAME'..."
empty_bucket_if_output() {
    local key=$1
    local bucket_name
    bucket_name=$($AWS_CMD cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue | [0]" --output text 2>/dev/null || true)
    
    if [[ -n "$bucket_name" ]] && [[ "$bucket_name" != "None" ]]; then
        echo "    Emptying s3://$bucket_name..."
        $AWS_CMD s3 rm "s3://$bucket_name" --recursive >/dev/null || true
    fi
}

empty_bucket_if_output "FrontendBucketName"
empty_bucket_if_output "ImagesBucketName"

echo "==> Deleting CloudFormation stack '$STACK_NAME'..."
$SAM_CMD delete --stack-name "$STACK_NAME" --no-prompts

echo ""
echo -e "\033[32mSuccessfully destroyed serverless stack: $STACK_NAME\033[0m"
