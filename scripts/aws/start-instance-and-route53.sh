#!/usr/bin/env bash
set -euo pipefail

INSTANCE_ID="i-0258aeb034ff9ff59"
HOSTED_ZONE_ID="Z9BOP06BJ5R7P"
RECORD_NAME="ec2-openclaw.now4real.com"
TTL="60"
REGION="eu-west-1"

if ! command -v aws >/dev/null 2>&1; then
  echo "Error: aws CLI not found in PATH." >&2
  exit 1
fi

AWS_ARGS=()
if [[ -n "$REGION" ]]; then
  AWS_ARGS+=(--region "$REGION")
fi

if [[ -z "$INSTANCE_ID" || -z "$HOSTED_ZONE_ID" || -z "$RECORD_NAME" ]]; then
  echo "Error: configure INSTANCE_ID, HOSTED_ZONE_ID and RECORD_NAME at the top of the script." >&2
  exit 1
fi

if [[ "$RECORD_NAME" != *. ]]; then
  RECORD_NAME="${RECORD_NAME}."
fi

echo "Starting instance ${INSTANCE_ID}..."
aws "${AWS_ARGS[@]}" ec2 start-instances --instance-ids "$INSTANCE_ID" >/dev/null

echo "Waiting for instance to reach running state..."
aws "${AWS_ARGS[@]}" ec2 wait instance-running --instance-ids "$INSTANCE_ID"

PUBLIC_IP="$(aws "${AWS_ARGS[@]}" ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)"

if [[ -z "$PUBLIC_IP" || "$PUBLIC_IP" == "None" ]]; then
  echo "Error: instance is running but no public IP was found." >&2
  exit 1
fi

CHANGE_BATCH="$(cat <<EOF
{
  "Comment": "UPSERT A record for ${RECORD_NAME} -> ${PUBLIC_IP}",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${RECORD_NAME}",
        "Type": "A",
        "TTL": ${TTL},
        "ResourceRecords": [
          { "Value": "${PUBLIC_IP}" }
        ]
      }
    }
  ]
}
EOF
)"

echo "Upserting Route53 record ${RECORD_NAME} in hosted zone ${HOSTED_ZONE_ID}..."
aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch "$CHANGE_BATCH" >/dev/null

echo "Done. ${RECORD_NAME} now points to ${PUBLIC_IP}."
