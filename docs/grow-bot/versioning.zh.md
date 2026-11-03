# Grow Bot 版本管理、备份与升级流程

> 适用：本仓库的 Grow Bot 二创线（分支 `my/app`），不适用于上游 DS-Bot 发版流程。
> 上游发版检查清单归档在仓库外 `.tools/archive/upstream-docs/release-checklist.md`。

## 0. 原则

1. **每次升级都能回到上一个已知可用版本**：版本标签 + bundle + 可重装的 App 三件套。
2. **版本号单一事实源**：`app/package.json` 与 `ds-bot/package.json` 必须一致，
   `app/test/package.test.mjs` 会强制检查。
3. **不 patch DSH**（AGENTS.md 硬规则）：升级 = 换依赖版本 / 改 composition / 加插件。
4. **`client.js` 是生成物**：改 `ds-bot/src/client/` 后 `npm run build`，两个文件一起提交。
5. **升级小步走**：每个阶段一个分支、一次备份、一道验收门；不通过就停在上一阶段。

## 1. 版本管理

### 1.1 版本号与标签

| 项 | 约定 |
|---|---|
| 版本号 | `0.<minor>.<n>`：`minor` 跟随上游主次版本，`n` 是 Grow Bot 自有补丁号 |
| 预发布 | `0.<minor>.<n>-grow-bot.<k>`（高风险升级先发预发布） |
| 版本标签 | `grow-bot-v0.3.2` 等（打在当前集成分支的提交上） |
| 上游标签 | `v0.2.x` 保持不动，与 Grow Bot 标签分开命名空间 |
| 检查点标签 | `checkpoint-<时间戳>`：每次备份自动打，不代表版本 |

### 1.2 分支

- `my/app`：集成分支，只有通过验收的改动才合进来。
- 工作分支：`upgrade/p1-jobs`、`feat/xxx`、`fix/xxx`，从 `my/app` 切出，合并用 `git merge --no-ff`。
- 不 rebase 已推送分支；本仓库不推送，仍按此习惯避免丢历史。

### 1.3 提交信息

`<type>(<scope>): <说明>`，type 用 `feat|fix|refactor|chore|docs|test|perf`，
scope 用 `app|ds-bot|docs|scripts`。例：`feat(app): 后台任务状态条`。
一次提交只做一件事；`client.js` 与其 `src/client` 改动同提交。

### 1.4 改版本号

```bash
node scripts/grow-bot-bump-version.mjs 0.3.3
```

脚本同时改两个 `package.json`；之后跑 `app/` 的测试确认版本一致性检查通过。

### 1.5 变更记录

- 写根目录 `CHANGELOG.md`（**不要改上游 CHANGELOG（仓库外归档）**）。
- 发版时把 `Unreleased` 段落改成 `[0.<minor>.<n>] - 日期`。

## 2. Git 备份

### 2.1 备份内容

`git bundle --all` 打包**全部提交、分支、标签**（约 13M）。
不备份工作树大文件：`app/dist-*`、`node_modules`、`dev/harness`、`.tools` 缓存（都可重建）。

### 2.2 一键备份

```bash
scripts/grow-bot-backup.sh "阶段说明"
```

它做五件事：

1. `git add -A` + `commit`（工作树干净则跳过）；
2. 打 `checkpoint-<时间戳>` 标签；
3. `git bundle create --all` 到 `../.tools/backups/grow-bot-my-app-<时间戳>.bundle`；
4. `git bundle verify` 校验；
5. 只保留最近 10 份；设置 `GROW_BOT_BACKUP_EXTERNAL=<目录>` 时额外复制一份到外部目录。

### 2.3 备份时机

- 每个升级阶段**开始前**和**结束后**；
- 每次发版前（打完版本标签之后）；
- 每周至少一次（有改动就做）。

### 2.4 异地副本（必做）

本机 bundle 不算真备份。至少满足一条：

- `GROW_BOT_BACKUP_EXTERNAL` 指向外置磁盘 / iCloud / 网盘目录；
- 或把最近一份 bundle 手动拷贝到另一台设备；
- 或给 `grow-bot` 远程配好 token 后推到一个独立的备份分支，**不要**推到公开 `main`。

### 2.5 恢复演练（每季度一次）

```bash
# 方式一：从 bundle 还原到临时目录验证
git clone ../.tools/backups/grow-bot-my-app-<时间戳>.bundle /tmp/grow-bot-restore
git -C /tmp/grow-bot-restore log -1 --oneline

# 方式二：回滚当前仓库到某个检查点/版本（会丢未提交改动）
git reset --hard checkpoint-<时间戳>
git reset --hard grow-bot-v0.3.2
```

App 回滚：检出旧版本标签后运行 `scripts/rebuild-grow-bot.sh`，或换回旧包后 `scripts/rebuild-grow-bot.sh` 重装。

## 3. 升级流程

```
P0 基线 → P1 零架构改动 → P2 官方包按需挂载 → P3 DSH 版本升级 → P4 实验/自研
```

每个阶段的出口都是：**测试通过 + 手动验收 + 备份 + 打版本标签**。

### P0 基线门禁（升级前必须全绿）

- [ ] `app/package.json` 与 `ds-bot/package.json` 版本一致
- [ ] `cd ds-bot && npm test && node scripts/build-client.mjs --check && npm run lint`
- [ ] `cd app && npm test`
- [ ] 已安装 App 版本 == 仓库版本（`defaults read /Applications/Grow Bot.app/Contents/Info.plist CFBundleShortVersionString`）
- [ ] 已打版本标签 `grow-bot-v0.2.N` 并完成备份
- [ ] 打标签前处理完并行会话的未提交改动（见第 4 节）

### P1 零架构改动（最划算，1~2 天）

Bot 提示词在 `ds-bot/src/host/prompt.js`，能力行由 `app/src/grow-bot-preset.mjs` 的启动 overlay 注入：

- **P1.1 后台任务**：Bot 长命令走 `bash run_in_background` + `job_output`，UI 展示后台任务状态。
  验收：跑长命令时聊天不被阻塞；结果可回看、可取消。
- **P1.2 Worker 化**：主 Bot 只分派与验收，重活交给 `subagent`（`backgroundMode: continuable`）。
  验收：主 Bot 响应不被占用；子代理上下文隔离；结果汇报给主 Bot。
- **P1.3 上下文**：确认 `dsh-spill-local`/`spill-policy`、`tool-result-pruner` 生效。
  验收：长工具输出不再撑爆窗口；会话可继续。

回滚：`git reset --hard checkpoint-<阶段前时间戳>` + 重装 App。

### P2 官方包按需挂载（改 composition）

- **P2.1 定时提醒**：挂 `@deepseek-ai/dsh-schedule` + `dsh-tool-schedule`（参考 `dsh-web-app/cordis.patch.yml`）。
- **P2.2 目标持续推进**：在 preset 恢复 `tool-goal` / `command-goal`（当前被刻意移除）。
- **P2.3 多工位**：`dsh-experimental-tool-worktree`（实验性，默认关闭）。

每项：改 `app/src/grow-bot-preset.mjs` 的 overlay（或 ds-bot 插件）→ 跑测试 → 冒烟 → 文档记录。

### P3 DSH 版本升级（如 0.2.1-rc.4 → 0.2.1-rc.5）

1. 读上游该版本变更；记录不兼容点。
2. 新建分支 `upgrade/dsh-0.2.1-rc.5`。
3. 更新 `app/package.json` 里全部 `@deepseek-ai/dsh*` 版本（311 个包，统一版本号）。
4. 对比新版 `dsh-web-app/cordis.patch.yml`、`presets/standard.patch.yml` 与本仓库
   `app/src/profile.mjs`、`app/src/grow-bot-preset.mjs`，补上新增行、调整 overlay。
5. `cd ds-bot && npm run harness`（测试用 DSH）→ `npm test` → `--check` → `lint`。
6. `cd app && npm ci --ignore-scripts` → 恢复 electron dist → `npm test`。
7. `scripts/rebuild-grow-bot.sh` 打包安装 → 按 `.tools/archive/upstream-docs/release-checklist.md` 真机回归。
8. 通过则合入 `my/app`、打 `grow-bot-v0.2.N`、备份；不通过则 `git reset --hard` 回阶段前检查点。

**注意**：不要升到 `0.2.2-alpha.*`（alpha 通道），先走 rc 通道。

### P4 实验/自研

- Agent Teams / 跨会话检索 / worktree 已在 0.3.2 转正（`app/src/grow-bot-preset.mjs`）；
- Trigger 事件源接入、`dsh-acp` 外部驱动仍在独立分支实验，见
  `docs/grow-bot/plans/2026-10-31-superagent-p4-experiments.md`。

## 4. 并行会话协作纪律

本仓库可能同时有多个 DSH 会话在改（实测出现过 84 个文件同时未提交）：

- 同一时间只允许一个会话承担 `my/app` 的集成与打标签；
- 其他会话在独立分支/工作树工作，提交小步、频繁；
- 打版本标签前，先确认工作树里没有别的会话写到一半的文件；
- 备份脚本会 `git add -A`，等于替所有会话做检查点——这是有意的，但要知道它在做什么。

## 5. 常用命令速查

```bash
# 版本号
node scripts/grow-bot-bump-version.mjs 0.3.3

# 备份
scripts/grow-bot-backup.sh "P1.1 done"
GROW_BOT_BACKUP_EXTERNAL=/Volumes/Backup/grow-bot scripts/grow-bot-backup.sh "weekly"

# 标签
git tag -a grow-bot-v0.3.3 -m "Grow Bot 0.3.3" && git push --tags  # 推送需先配 remote

# 测试（需要便携 node）
export PATH="$(git rev-parse --show-toplevel)/../.tools/node/bin:$PATH"
cd ds-bot && npm test && node scripts/build-client.mjs --check && npm run lint
cd ../app && env -u ELECTRON_RUN_AS_NODE npm test

# 构建安装
scripts/rebuild-grow-bot.sh
```

## 6. 当前基线（2026-10-31 建立）

| 项 | 值 |
|---|---|
| 版本 | `0.3.2`（app 与 ds-bot 一致） |
| 版本标签 | `grow-bot-v0.3.2` |
| 已安装 App | `/Applications/Grow Bot.app` 0.3.2 |
| 备份脚本 | `scripts/grow-bot-backup.sh` |
| 备份目录 | `../.tools/backups/` |
| 上游 DSH | `0.2.1-rc.5`（已升级） |
