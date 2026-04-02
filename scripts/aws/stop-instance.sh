#!/usr/bin/env bash
set -euo pipefail

INSTANCE_ID="i-0258aeb034ff9ff59"
REGION="eu-west-1"

if ! command -v aws >/dev/null 2>&1; then
  echo "Error: aws CLI not found in PATH." >&2
  exit 1
fi

AWS_ARGS=()
if [[ -n "$REGION" ]]; then
  AWS_ARGS+=(--region "$REGION")
fi

if [[ -z "$INSTANCE_ID" ]]; then
  echo "Error: configure INSTANCE_ID at the top of the script." >&2
  exit 1
fi

echo "Stopping instance ${INSTANCE_ID}..."
aws "${AWS_ARGS[@]}" ec2 stop-instances --instance-ids "$INSTANCE_ID" >/dev/null

echo "Waiting for instance to reach stopped state..."
aws "${AWS_ARGS[@]}" ec2 wait instance-stopped --instance-ids "$INSTANCE_ID"

echo "Done. Instance ${INSTANCE_ID} is stopped."
