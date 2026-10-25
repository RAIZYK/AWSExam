#!/usr/bin/env bash
set -euo pipefail
: "${S3_BUCKET:?Set S3_BUCKET to your existing bucket name}"
AWS_REGION="${AWS_REGION:-us-east-1}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"
rm -rf "$DIST"
mkdir -p "$DIST"
cp "$ROOT"/frontend/index.html "$ROOT"/frontend/styles.css "$ROOT"/frontend/app.js "$DIST"/
if [[ -f "$ROOT/frontend/runtime-config.js" ]]; then
  cp "$ROOT/frontend/runtime-config.js" "$DIST"/
else
  cp "$ROOT/frontend/runtime-config.example.js" "$DIST/runtime-config.js"
  echo "WARNING: runtime-config.js is using an empty API URL. Configure it for your deployed API." >&2
fi
aws s3 sync "$DIST/" "s3://${S3_BUCKET}/" --region "$AWS_REGION" --delete \
  --cache-control "public,max-age=300"
echo "Frontend files synced to s3://${S3_BUCKET}/"
echo "Configure CloudFront invalidation and DNS separately if applicable."
