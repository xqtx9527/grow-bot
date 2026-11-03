# grow-bot plugin

Grow Bot 的 DeepSeek Harness 插件：把 DSH 变成一组长期在线的 Bot 团队。

## 能力

- 每个 Bot 是一个长期存在的身份，拥有自己的对话、记忆、模型和工作目录。
- Bot 之间可以互相发消息、在群聊里协作；主 Bot 负责分派与汇总。
- 群聊支持 @ 指定发言人、引用其他会话、按角色与权限运行。
- 与桌面壳配合提供会话、侧栏、设置、用量、定时任务和模型设置界面。

## 目录

- `src/host/`：服务端（Bot 名册、工具、回合与投递、群聊、搜索索引、浏览器桥）。
- `src/client/`：浏览器端（侧栏、会话、面板、主题、角色）。
- `client.js`：由 `src/client/` 构建生成，**不要手改**。
- `test/`：单元测试；`dev/`：mock 模型与测试台。

## 构建与测试

```bash
npm run build                 # src/client -> client.js
npm run harness               # 首次或清理后安装测试用 DSH 包
npm test
node scripts/build-client.mjs --check
npm run lint
```

## 许可

Apache-2.0；第三方说明见仓库根目录 `NOTICE`。
