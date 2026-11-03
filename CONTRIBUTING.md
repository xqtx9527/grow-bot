# Contributing to Grow Bot

Issues and pull requests are welcome. Please open an issue first for a large change.

## Set up

```bash
cd ds-bot
npm ci
npm run harness
npm test
```

For the desktop app, run `npm ci --legacy-peer-deps` in `app/`. Keep that flag: the lockfile is written with it.

## The rules that matter most

1. **Build on DeepSeek Harness; never patch it.** Use its documented plugin APIs.
2. **No secrets.** Never commit API keys, tokens, cookies or the contents of a `DSH_HOME`. Tests use the mock model
   in `ds-bot/dev/mock-llm.mjs` and temporary folders.
3. **Only original material.** Code under a license compatible with Apache-2.0 is the exception: say where it comes
   from and record it in `NOTICE`.
4. **`ds-bot/client.js` is generated.** Change `ds-bot/src/client/`, run `npm run build` and commit both files.

## Before a pull request

```bash
scripts/check-all.sh
```

It runs the lint, the client build check, both test suites and a packaged app in a real window. Keep commits small,
with an English imperative subject and the reason in the body. User-facing text in the app is English.

By contributing you agree that your work is licensed under the [Apache License 2.0](LICENSE).
