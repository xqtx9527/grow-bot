# Grow Bot

[English](README.md) | 中文

Grow Bot 是一个基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 macOS 桌面 AI 助手：
一组长期在线的 Bot 团队，可以在自己的对话或群聊里协作完成任务。

- 当前版本：**0.2.0**（预览版，尚未签名）
- 运行环境：macOS（Apple 芯片），基于 DeepSeek Harness 构建
- 模型：默认走官方 DeepSeek 通道，也可通过 Magpie 网关接入其他模型

## 能力

- 多个长期在线的 Bot：独立对话、记忆、模型与工作目录。
- 群聊协作：Bot 互相委托任务、共享进度，主 Bot 负责分派与汇总。
- 桌面应用：会话、侧栏、Bot 设置、用量、定时任务、模型设置。
- 实验能力（默认开启，官方标 experimental）：Agent Teams 会话内组队、跨会话检索、
  Git worktree 并行副本。

## 仓库结构

```
grow-bot/
├── app/                  Electron 桌面壳（窗口、托盘、更新、打包、启动补丁）
├── ds-bot/               DeepSeek Harness 插件（host + client + office 工具）
├── browser-plugins/      Bot 浏览器使用的扩展
├── docs/
│   └── grow-bot/             项目文档（交接、版本流程、设计计划）
├── scripts/              构建、回退、备份、版本号脚本
├── .agents/              给 AI agent 用的技能
├── AGENTS.md             agent 开发约定
├── CONTRIBUTING.md       贡献说明
├── SECURITY.md           安全说明
├── CHANGELOG.md          Grow Bot 变更记录
├── LICENSE / NOTICE      许可与第三方说明
└── README.md
```

## 快速开始

前置条件：macOS（Apple 芯片）、本机没有系统 Node 时使用仓库外的便携版
`../.tools/node/bin`，已装 Node 24 就不需要。

一键构建、安装并重启：

```bash
scripts/rebuild-grow-bot.sh
```

## 开发

```bash
# 便携 Node（已装 Node 24 可跳过）
export PATH="$(git rev-parse --show-toplevel)/../.tools/node/bin:$PATH"

# 插件：单元测试 / 构建 / 静态检查
cd ds-bot
npm run harness            # 首次或清理后安装测试用 DSH 包
npm test
npm run lint

# 桌面壳：测试
cd app
env -u ELECTRON_RUN_AS_NODE npm test
npm run build

# 版本号：两个 package.json 同步修改
node scripts/grow-bot-bump-version.mjs 0.3.3
```

## 数据位置

| 数据 | 路径 |
|---|---|
| App 数据（Bot / 会话 / 记忆 / 凭证） | `~/.ds-bot` |
| App 窗口与登录状态 | `~/Library/Application Support/Grow Bot` |
| Bot 工作文件 | Bot 或群聊设置的工作目录（如 `~/Grow Bot`） |
| 开发用便携 Node / 备份 | `../.tools/node`、`../.tools/backups` |

不要提交任何凭证、聊天记录或个人数据。

## 版本与备份

- 版本号以 `app/package.json` 与 `ds-bot/package.json` 为准，二者必须一致。
- 版本标签：`grow-bot-v0.3.2` 等；备份脚本：`scripts/grow-bot-backup.sh`。
- 备份 bundle 保存在仓库外的 `../.tools/backups/`。

更多说明见 [docs/grow-bot/HANDOFF.md](docs/grow-bot/HANDOFF.md) 和
[docs/grow-bot/versioning.zh.md](docs/grow-bot/versioning.zh.md)。

## 致谢与许可

本项目基于 DeepSeek Harness 构建，并使用了 blob-avatar 等开源项目。
版权与许可证说明见 [LICENSE](LICENSE)、[NOTICE](NOTICE) 以及各组件内的许可证。
