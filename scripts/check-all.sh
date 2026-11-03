#!/bin/bash
# Every check of a change, in one go: lint, the client build, both test suites, then a packaged
# app driven through a real window. Nothing is installed.
# Usage: scripts/check-all.sh
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(dirname "$REPO")"

export PATH="$ROOT/.tools/node/bin:$PATH"
export npm_config_cache="$ROOT/.tools/npm-cache"
export npm_config_logs_dir="$npm_config_cache/_logs"
export ELECTRON_BUILDER_CACHE="$ROOT/.tools/eb-cache"
export CSC_IDENTITY_AUTO_DISCOVERY=false

echo "== 1/4 plugin =="
cd "$REPO/ds-bot"
npm run lint
npm run build
node scripts/build-client.mjs --check
npm test

echo "== 2/4 copy the plugin into the app =="
rm -rf "$REPO/app/node_modules/ds-bot"
mkdir -p "$REPO/app/node_modules/ds-bot"
cp -R index.js client.js office.js web-search.js cordis.patch.yml README.md LICENSE package.json src \
  "$REPO/app/node_modules/ds-bot/"

echo "== 3/4 desktop app =="
cd "$REPO/app"
env -u ELECTRON_RUN_AS_NODE npm test

echo "== 4/4 packaged app =="
rm -rf dist-pack
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron-builder --dir --publish never \
  --config.electronDist="$REPO/app/node_modules/electron/dist" | tail -3
env -u ELECTRON_RUN_AS_NODE npm run check-packed

echo "== all checks passed =="
