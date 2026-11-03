#!/bin/bash
# Rebuild the Grow Bot plugin and desktop app, install it to /Applications, relaunch.
# Usage: scripts/rebuild-grow-bot.sh
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(dirname "$REPO")"
NODE_BIN="$ROOT/.tools/node/bin"
APP="Grow Bot"

export PATH="$NODE_BIN:$PATH"
export npm_config_cache="$ROOT/.tools/npm-cache"
export npm_config_logs_dir="$npm_config_cache/_logs"
export ELECTRON_BUILDER_CACHE="$ROOT/.tools/eb-cache"
export CSC_IDENTITY_AUTO_DISCOVERY=false

echo "== 1/5 build the plugin bundle =="
cd "$REPO/ds-bot"
npm run build
node scripts/build-client.mjs --check

echo "== 2/5 copy the plugin into the app =="
cd "$REPO/ds-bot"
rm -rf "$REPO/app/node_modules/ds-bot"
mkdir -p "$REPO/app/node_modules/ds-bot"
cp -R index.js client.js office.js web-search.js cordis.patch.yml README.md LICENSE package.json src \
  "$REPO/app/node_modules/ds-bot/"

echo "== 3/5 package the app =="
cd "$REPO/app"
rm -rf dist-pack
env -u ELECTRON_RUN_AS_NODE ./node_modules/.bin/electron-builder --dir --publish never \
  --config.electronDist="$REPO/app/node_modules/electron/dist" | tail -3

echo "== 4/5 install to /Applications =="
pkill -f "Applications/$APP.app" 2>/dev/null || true
pkill -f "app.asar/src/host.mjs" 2>/dev/null || true
sleep 2
rm -rf "/Applications/$APP.app"
ditto "$REPO/app/dist-pack/mac-arm64/$APP.app" "/Applications/$APP.app"
xattr -dr com.apple.quarantine "/Applications/$APP.app" 2>/dev/null || true

echo "== 5/5 relaunch =="
killall Dock 2>/dev/null || true
sleep 1
osascript -e "tell application \"Finder\" to open application file \"$APP.app\" of folder \"Applications\" of startup disk" >/dev/null 2>&1 || true
sleep 6
pgrep -fl "Applications/$APP.app/Contents/MacOS/$APP" | head -2 || echo "app not running; open it from /Applications"
