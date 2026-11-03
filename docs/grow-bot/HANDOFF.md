# Grow Bot（Grow Bot）项目交接文档

> 给接手的 AI / 开发者：按本文档可以直接继续开发、构建、安装。
> 最后更新：2026-10-31 23:10（macOS arm64；仓库已按标准结构整理）

---

## 1. 文件在哪里

| 内容 | 路径 |
|---|---|
| **主仓库（要改的就是这里）** | `<repo>` |
| 当前分支 / 版本 | `my/app` / 0.3.2（提交见 `git log`） |
| 已安装的 App | `/Applications/Grow Bot.app`（v0.3.2，bundle id `local.grow-bot.app`） |
| 便携 Node（系统没有 node/npm） | `../.tools/node/bin`（v24.11.0） |
| 备份（git bundle） | `../.tools/backups/`（保留最近 10 份） |
| 一键重装 | `scripts/rebuild-grow-bot.sh` |
| App 数据（Bot / 聊天 / 记忆 / 凭证） | `~/.ds-bot` |
| App 自身数据（窗口/登录状态） | `~/Library/Application Support/Grow Bot` |
| Bot 工作文件 | Bot / 群聊设置的工作目录（如 `~/Grow Bot`） |
| 旧的 DSH Desktop 团队数据（不归 App 管） | `~/.dsh` |

---

## 2. 仓库结构

```
grow-bot/
├── app/                  Electron 桌面壳
│   ├── src/              host、窗口、启动补丁（含 grow-bot-preset.mjs）
│   ├── test/             桌面端测试
│   └── electron-builder.yml
├── ds-bot/               DSH 插件本体
│   ├── src/host/         后端
│   ├── src/client/       前端（构建为 client.js）
│   ├── test/             插件测试（需要 dev/harness）
│   └── dev/              mock 模型、测试台等
├── browser-plugins/      Bot 浏览器扩展
├── docs/
│   ├── grow-bot/             本项目文档（本文、版本流程、设计计划）
├── .agents/              AI agent 技能
├── AGENTS.md             开发约定
├── CHANGELOG.md          Grow Bot 变更记录
├── LICENSE / NOTICE
└── README.md
```

---

## 3. 版本与分支

- 版本：`app/package.json` = `ds-bot/package.json` = **0.3.2**（测试强制一致）。
- 标签：`grow-bot-v0.2.6 … grow-bot-v0.3.2`。
- 分支：`my/app` 主线；历史实验分支（`upgrade/*`、`experiment/*`）可删可留。
- 公开仓库：`github.com/xqtx9527/grow-bot`。

已完成的主要升级（2026-10-31）：

1. 基础功能回绿：修复 About 更新区、侧栏收起按钮、新建 Bot 默认名等回归。
2. 移除 Magpie，模型回到官方 DeepSeek 通道。
3. 设置只保留「模型设置」，移除「服务商」页面与账号登录区块。
4. P1.2：Bot 把自包含多步任务交给 `subagent`/`subagent_fork`，对话保持响应。
5. P1.3：确认 Spill（`maxInlineTokens: 12500`）与 compaction/tool-result-pruner 生效。
6. P2：官方 `dsh-schedule`、`command-goal`/`tool-goal`、worktree 工具接入。
7. P3：DSH `0.2.1-rc.4 → 0.2.1-rc.5` 全量升级。
8. P4 转正：Agent Teams、跨会话检索、worktree 默认开启（见下一节）。

---

## 4. 实验能力（默认开启）

`app/src/grow-bot-preset.mjs` 在每次启动时生成
`~/.ds-bot/profiles/grow-bot-preset.patch.yml` 作为 `--patch` overlay（不改用户配置）：

- Bot 预设追加：`tool-worktree`、`tool-agent-team`、`session-search`。
- 宿主层追加：`agent-team`、`worktree-service`。
- `worktree-service.nodeCommand` 指向 App 自带 Node：
  `/Applications/Grow Bot.app/Contents/Resources/primary-runtime/dependencies/node/bin/node`。

已知边界：

- `session_search` 只检索**当前工作区**的历史会话。
- 官方把这些标为 experimental，稳定性风险自负。
- `app/engine/` 旧配置层已删除；真正生效的是 `app/src/` 的启动补丁。

---

## 5. 环境与构建

```bash
export PATH="$(git rev-parse --show-toplevel)/../.tools/node/bin:$PATH"
export npm_config_cache="$(git rev-parse --show-toplevel)/../.tools/npm-cache"
export npm_config_logs_dir="$npm_config_cache/_logs"
```

注意：

1. 系统 PATH 没有 node/npm，用便携版。
2. 终端常带 `ELECTRON_RUN_AS_NODE=1`，启动 Electron / electron-builder 前用 `env -u`。
3. Electron 已解压在 `app/node_modules/electron/dist`。
4. 清理后 `app/build/runtime`、`ds-bot/dev/harness`、`.tools/npm-cache` 已删除：
   - 跑 ds-bot 测试/lint 前先 `cd ds-bot && npm run harness`；
   - `scripts/rebuild-grow-bot.sh` 打包时会自动重新准备 Office runtime。

```bash
# 插件
cd ds-bot && npm run harness && npm test && node scripts/build-client.mjs --check && npm run lint

# 桌面端
cd app && env -u ELECTRON_RUN_AS_NODE npm test

# 一键打包安装
scripts/rebuild-grow-bot.sh
```

---

## 6. 备份与回滚

- 发版：`scripts/grow-bot-backup.sh "说明"` → checkpoint 提交 + `checkpoint-*` 标签 + 全量 bundle。
- 代码回滚：`git reset --hard grow-bot-v0.3.2`（或对应标签）。
- 手动备份数据：`cp -R ~/.ds-bot ~/Desktop/ds-bot-backup`。

---

## 7. 2026-10-31 整理记录

空间清理：工作区 **12G → 1.3G**（删除 8 个历史打包目录、Office runtime 缓存、
测试 harness、npm/构建缓存、旧 App 备份、旧截图与临时目录）。

仓库结构调整：

- 仓库目录 `DS-Bot/` 重命名为 `grow-bot/`；工作区根目录只留 `grow-bot/` 和 `.tools/`。
- 脚本与交接文档进入仓库（`scripts/`、`docs/grow-bot/`）。
- 文档拆分：`docs/grow-bot/`（本项目）；上游历史文档移到仓库外 `.tools/archive/upstream-docs/`。
- 删除上游遗留且未使用的 `mobile/`、`docker/`、`.github/`、`start.ps1`、
  `.dockerignore`、`docker-compose.yml`，以及已退役的 `app/engine/`。
  历史仍保留在 git 中，可随时找回。

---

## 8. 需要人工确认的事

- 模型：官方 DeepSeek 的账号或 API key 需要在 App 的「模型设置」里配置。
- 旧团队：`~/.dsh` 里的团队不会自动导入 App（App 用 `~/.ds-bot`）。
- 设置 → 定时任务：官方 schedule 服务已挂载，可实际建提醒验证。
