# Grow Bot

English | [中文](README.zh.md)

Grow Bot is a desktop AI assistant built on [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness):
a team of long-lived Bots, each with its own conversations, memory, model and working folder, that work
alone or together in group chats.

> **Preview, version 0.5.1.** Developed on macOS with Apple silicon. Builds are unsigned. Windows support
> is in the code, but it has not been run yet; see [docs/grow-bot/windows.zh.md](docs/grow-bot/windows.zh.md).

## What it does

- **Long-lived Bots**: separate conversations, memory, models and folders.
- **Group chats**: Bots hand work to each other, and a Main Bot assigns and sums up.
- **A desktop app**: sessions, Bot settings, usage, schedules, model settings, a browser for Bots and Office tools.
- **Characters that respond**: Bots move with what they are doing and answer clicks and the pointer.
- **Any model**: connect the [Magpie](https://github.com/yetone/magpie) gateway to give each Bot a different model.
- **Your data stays local**: everything lives in `~/.ds-bot`; models are reached with your own account or API key.

## Build it

You need macOS on Apple silicon and Node 24.

```bash
cd ds-bot && npm ci && npm run harness && cd ..
cd app && npm ci --legacy-peer-deps && npm run runtime && cd ..
scripts/rebuild-grow-bot.sh
```

`rebuild-grow-bot.sh` builds the app, installs it to `/Applications` and starts it. To run every check
without installing, use `scripts/check-all.sh`.

## Layout

```
app/              Electron desktop app
ds-bot/           DeepSeek Harness plugin: Bots, memory, group chats, Office tools
browser-plugins/  Browser backends for Bots
docs/grow-bot/        Design notes and process (Chinese)
scripts/          Build, check, version and backup commands
```

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). [AGENTS.md](AGENTS.md) holds the rules
for AI coding agents, and they apply to everyone.

## License

[Apache License 2.0](LICENSE). Grow Bot grew out of [DS-Bot](https://github.com/Fei2411/DS-Bot); that work and other
third-party material are credited in [NOTICE](NOTICE).
