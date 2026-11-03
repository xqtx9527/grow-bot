#!/usr/bin/env bash
# Grow Bot 一键 Git 备份。
#
# 用法:
#   scripts/grow-bot-backup.sh ["说明文字"]
#
# 做的事: 检查点提交(有改动时) -> checkpoint 标签 -> 全量 bundle -> 校验 -> 保留最近 N 份
#
# 环境变量:
#   GROW_BOT_BACKUP_DIR       备份目录, 默认 <workspace>/.tools/backups
#   GROW_BOT_BACKUP_KEEP      保留份数, 默认 10
#   GROW_BOT_BACKUP_EXTERNAL  可选: 外部备份目录(外置磁盘/网盘), 会额外复制一份
#   GROW_BOT_AUTHOR_NAME / GROW_BOT_AUTHOR_EMAIL  提交身份, 默认取 git config
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="$(dirname "$REPO")"
BACKUP_DIR="${GROW_BOT_BACKUP_DIR:-$WORKSPACE/.tools/backups}"
KEEP="${GROW_BOT_BACKUP_KEEP:-10}"
AUTHOR_NAME="${GROW_BOT_AUTHOR_NAME:-$(git -C "$REPO" config user.name || echo qinsir)}"
AUTHOR_EMAIL="${GROW_BOT_AUTHOR_EMAIL:-$(git -C "$REPO" config user.email || echo qinsir@users.noreply.github.com)}"
NOTE="${1:-manual backup}"
TS="$(date +%Y%m%d-%H%M%S)"

cd "$REPO"

GIT_ID=(-c "user.name=$AUTHOR_NAME" -c "user.email=$AUTHOR_EMAIL")

echo "== 1/5 checkpoint =="
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git "${GIT_ID[@]}" commit -q -m "checkpoint: $TS $NOTE"
  echo "committed $(git log -1 --format='%h %s')"
else
  echo "working tree clean, no commit"
fi

echo "== 2/5 tag =="
TAG="checkpoint-$TS"
git "${GIT_ID[@]}" tag -a "$TAG" -m "checkpoint $TS: $NOTE"
echo "tagged $TAG"

echo "== 3/5 bundle =="
mkdir -p "$BACKUP_DIR"
BUNDLE="$BACKUP_DIR/grow-bot-my-app-$TS.bundle"
git bundle create "$BUNDLE" --all >/dev/null

echo "== 4/5 verify =="
git bundle verify "$BUNDLE" >/dev/null
echo "OK $(du -h "$BUNDLE" | cut -f1)  $BUNDLE"

if [ -n "${GROW_BOT_BACKUP_EXTERNAL:-}" ]; then
  mkdir -p "$GROW_BOT_BACKUP_EXTERNAL"
  cp -p "$BUNDLE" "$GROW_BOT_BACKUP_EXTERNAL/"
  echo "copied to $GROW_BOT_BACKUP_EXTERNAL"
fi

echo "== 5/5 prune (keep $KEEP) =="
ls -1t "$BACKUP_DIR"/*my-app-*.bundle 2>/dev/null \
  | tail -n +$((KEEP + 1)) \
  | while read -r old; do rm -f "$old" && echo "pruned $old"; done || true

echo "== done =="
git log -1 --format='HEAD %h %s'
echo "checkpoints: $(git tag -l 'checkpoint-*' | wc -l | tr -d ' ')  | bundles: $(ls -1 "$BACKUP_DIR"/*my-app-*.bundle 2>/dev/null | wc -l | tr -d ' ')"
