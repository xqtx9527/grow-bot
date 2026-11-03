# P4：Super-agent 实验线（已转正，0.3.2）

> 已转正：由 `app/src/grow-bot-preset.mjs` 在每次启动时生成 overlay，默认开启；不再手改用户 profile。
> 依据：DeepSeek Harness 团队《Super-agent 设计探索》(2026-10-31)。

## 1. 范围

| 实验 | 官方件 | 目标 | 默认 |
|---|---|---|---|
| Agent Teams | `dsh-experimental-agent-team` + `dsh-experimental-tool-agent-team` | 隐式根、成员直连、共享任务 DAG，近似文章 2.2 Worker 层 | 关闭 |
| 跨会话召回 | `dsh-experimental-session-search` | 文章 3.3 链式召回的检索底座：搜索并读取本工作区更早的 Session | 关闭 |
| 外部驱动（ACP） | `dsh-acp` + `dsh-acp-app` | 用 JSON-RPC 从外部驱动 Agent，作为 IM/CI 事件源的桥 | 不挂载 |

以上三行由 `app/src/grow-bot-preset.mjs` 在每次启动时生成 overlay 注入（0.3.2 起默认开启）；
宿主服务（agent-team、worktree-service）挂在宿主层。

## 2. Agent Teams 与 Grow Bot 现有 Bot 团队的关系

- 现有团队：`ds-bot` 自己的 Bot 名册、群聊、`message_bot`/`group_relay`（产品层）。
- Agent Teams：DSH 的 Session 级团队（执行层），每个 Session 可以有隐式根和多个
  成员，成员间直连、共享任务 DAG。
- 二者语义不同：不要把 `tool-agent-team` 直接开给普通 Bot，否则同一件事会有两套
  协调机制。实验时限定在**单个 Bot 的 Session** 内，用独立 profile。

## 3. Trigger（事件源）设计草案

DSH 没有现成的 Trigger 抽象，最小可行路径：

1. 事件采集：外部进程（QQ/飞书/CI webhook）→ 自定义 DSH 插件；
2. 过滤：程序层（来源、白名单、@/关键词）先挡掉噪音，再交模型判断（Fast/Slow Path）；
3. 路由：已订阅的 Thread 直通对应 Bot 的 Session，不经过主 Bot（只做冷启动分派）；
4. 去重与限流：每条 Trigger 带唯一 id，按 Thread 存最近 N 条；
5. 输出：Worker 不回信道，统一由主 Bot/Bot 汇总（文章 3.2）。

建议先用 `dsh-schedule` 的定时能力做"轮询式"事件源验证闭环，再上 webhook。

## 4. 验收标准（进入 `my/app` 之前）

- [x] 实验 profile 能启动，普通 profile 完全不受影响；
- [x] Agent Teams 打开后，单 Bot Session 内可创建成员并收到成员结果（mimo 实测：两个 teammate 并行查资料并汇总）；
- [x] session-search 能按关键词找到旧 Session 并读出内容（限当前工作区）；
- [x] ACP 已跑通 `initialize` 握手（独立 scratch profile）；
- [ ] 以上任一失败：保持分支，不合并。

## 5. 暂不做的部分

- 云端存算分离、端侧 daemon、A2A：与 Grow Bot 本地优先定位冲突，只作参考；
- Watchdog 外部控制回路：等 Trigger 闭环后再做；
- Router/Worker 双层：先用 Agent Teams 验证，再决定是否自研。
