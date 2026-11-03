# app — Grow Bot 桌面壳

Electron 应用，负责窗口、托盘、首启、更新、打包，以及在启动时给 DSH profile
注入本项目的补丁。

- `src/main.mjs`：主进程入口。
- `src/host.mjs`：启动 DSH Host，应用 `--patch` overlay（搜索选择器、Office、
  `grow-bot-preset.mjs` 的实验行），然后把窗口接到 loopback 地址。
- `src/profile.mjs`：定义 App 的 DSH profile（base + web-app + ds-bot 三个 bundle）。
- `src/grow-bot-preset.mjs`：每次启动生成 Agent Teams / 跨会话检索 / worktree 的预设补丁。
- `test/`：桌面端单元测试。

## 构建与安装

```bash
export PATH="$(git rev-parse --show-toplevel)/../.tools/node/bin:$PATH"
env -u ELECTRON_RUN_AS_NODE npm install   # 依赖变更时
env -u ELECTRON_RUN_AS_NODE npm test
```

打包、安装到 `/Applications` 并重启，请用仓库根目录的
`scripts/rebuild-grow-bot.sh`（它会先重建插件和窗口 UI）。

数据：
- App 数据（Bot / 会话 / 记忆）在 `~/.ds-bot`；
- 窗口与登录状态在 `~/Library/Application Support/Grow Bot`。
