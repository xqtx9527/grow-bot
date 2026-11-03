# AGENTS.md

Instructions for AI coding agents working on this repository. The human-facing
project overview is [README.md](README.md).

## What this project is

Grow Bot is a macOS desktop assistant built on DeepSeek Harness (DSH): a team of
long-lived Bots with their own conversations, memory, models and working
folders. It builds on DeepSeek Harness; third-party attribution lives in NOTICE.

- `ds-bot/`: the Bot features, written as a DSH plugin (host side and browser
  side), plus the Office tools.
- `app/`: the Electron desktop app. It runs a pinned DSH with the `ds-bot`
  plugin in its own profile and its own `DSH_HOME`.
- `docs/grow-bot/`: this project's design notes, versioning process and handoff.
- `scripts/`: build/install, revert, backup and version commands.

## Hard rules

1. **Build on DSH; never patch it.** Use the documented plugin APIs and boot
   through `@deepseek-ai/dsh/profile-boot` or the `dsh` CLI. Never edit a DSH
   install; if something is missing, stop and say so.
2. **No secrets.** Never write, print or commit API keys, tokens, cookies or
   `DSH_HOME` contents. Tests use the mock model (`ds-bot/dev/mock-llm.mjs`).
3. **Only original material.** Code under a license compatible with Apache-2.0
   is the only exception: say where it comes from and record it in `NOTICE`.
4. **`client.js` is generated.** Edit `ds-bot/src/client/`, run `npm run build`
   and commit both files. Never edit `client.js` by hand.
5. **Do not touch the user's own DSH data.** The app keeps its data in
   `~/.ds-bot`. Tests use `.dsh-test-<name>/` or temporary homes only; never
   point a test at `~/.dsh`, at the app's data, or at a DSH the user runs.
6. **The app's live preset rows come from `app/src/grow-bot-preset.mjs`.** It writes
   a `--patch` overlay at launch; changing Agent Teams / session-search /
   worktree rows means editing that module, not a retired `app/engine/` layer.

## Commands

```sh
export PATH="$(git rev-parse --show-toplevel)/../.tools/node/bin:$PATH"

# Plugin
cd ds-bot
npm run harness            # once after a fresh checkout or after .tools cleanup
npm test
node scripts/build-client.mjs --check
npm run lint

# Desktop app
cd app
env -u ELECTRON_RUN_AS_NODE npm test

# Every check, with a packaged app in a real window
scripts/check-all.sh

# Build + install + relaunch
scripts/rebuild-grow-bot.sh
```

A change is done when `npm test`, `node scripts/build-client.mjs --check` and
`npm run lint` pass. Run the app suite too for anything under `app/`.

## Working style

- Branch from `my/app` (`feat/...`, `fix/...`, `docs/...`, `chore/...`), keep
  commits small, English imperative subject with the reason in the body.
- The person who asked for the change is the commit author; never set an AI
  agent or bot as author or committer.
- Match the code around you; comment only non-obvious constraints.
- User-facing plugin text is English; Chinese documentation lives in
  `docs/grow-bot/`.
- Bump both `app/package.json` and `ds-bot/package.json` together, update
  `CHANGELOG.md`, tag `grow-bot-v<version>` and run `scripts/grow-bot-backup.sh`.
- Record new third-party material in `NOTICE`.
