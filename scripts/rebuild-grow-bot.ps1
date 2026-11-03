# Builds the Grow Bot plugin and desktop app on Windows, checks the result and starts it.
# Usage: scripts\rebuild-grow-bot.ps1
# It needs Node on PATH and `npm ci --ignore-scripts` plus the Electron download in app\.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'

Write-Host '== 1/4 build the plugin bundle =='
Set-Location "$repo\ds-bot"
npm run build
if ($LASTEXITCODE) { exit $LASTEXITCODE }
node scripts/build-client.mjs --check
if ($LASTEXITCODE) { exit $LASTEXITCODE }

Write-Host '== 2/4 copy the plugin into the app =='
$plugin = "$repo\app\node_modules\ds-bot"
if (Test-Path $plugin) { Remove-Item $plugin -Recurse -Force }
New-Item -ItemType Directory -Path $plugin | Out-Null
Copy-Item index.js, client.js, office.js, web-search.js, cordis.patch.yml, README.md, LICENSE, package.json, src $plugin -Recurse

Write-Host '== 3/4 package the app =='
Set-Location "$repo\app"
if (Test-Path dist-pack) { Remove-Item dist-pack -Recurse -Force }
& .\node_modules\.bin\electron-builder.cmd --dir --publish never --win
if ($LASTEXITCODE) { exit $LASTEXITCODE }

Write-Host '== 4/4 check and start =='
npm run check-packed
if ($LASTEXITCODE) { exit $LASTEXITCODE }
Start-Process "$repo\app\dist-pack\win-unpacked\Grow Bot.exe"
