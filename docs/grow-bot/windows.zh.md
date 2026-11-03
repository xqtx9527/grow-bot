# Windows 版

代码和打包配置都保留着 Windows 支持，但 macOS 上打不出 Windows 版：Office 运行时和原生模块按机器
下载，`before-pack` 会拒绝跨架构打包。下面的步骤要在 Windows x64 机器上做，目前都没有实际跑过。

## 打包和运行

```powershell
cd app
npm ci --ignore-scripts
node node_modules/electron/install.js
npm run runtime
cd ..
scripts\rebuild-grow-bot.ps1
```

`check-packed` 会打开打包后的应用，发一条消息，再检查点击反应、窄栏和关闭流程。`npm run dist` 产出
NSIS 安装包。

## 第一次要重点看

- 窗口：Mica 背景和标题栏按钮（`app/src/mica.css`、`window-frame.mjs`）。
- 托盘：`tray.ico`，关闭窗口后应用继续运行。
- 路径：数据默认在 `~/.ds-bot`，应用自身数据走 Electron 默认目录。
- Office 和语音：原生依赖能否加载。
- 从 Chrome 导入 Cookie：`browser-sources.mjs` 的 Windows 分支。

## 还没解决

- 没有代码签名，Windows 会提示未知发布者。
- 自动更新默认关闭：更新地址属于上游，要有自己的发布地址才能开。
