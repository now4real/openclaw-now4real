#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

PLUGIN_NAME="$(node -p "require('./package.json').name")"
ZIP_FILE="${PLUGIN_NAME}.zip"

echo "Building plugin..."
npm run build

echo "Creating archive ${ZIP_FILE}..."
rm -f "$ZIP_FILE"

zip -r "$ZIP_FILE" . \
  -x "node_modules/*" \
  -x "scripts/*" \
  -x "docs/*" \
  -x "doc/*" \
  -x ".git/*" \
  -x ".DS_Store" \
  -x ".gitignore" \
  -x "package-lock.json" \
  -x "$ZIP_FILE"

echo "Done: ${ZIP_FILE}"
