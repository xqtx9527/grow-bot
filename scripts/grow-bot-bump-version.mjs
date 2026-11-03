#!/usr/bin/env node
// 同时修改 app/package.json 与 ds-bot/package.json 的 version。
// 用法: node scripts/grow-bot-bump-version.mjs 0.2.7
//       node scripts/grow-bot-bump-version.mjs 0.2.7-grow-bot.1   # 预发布
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
const version = process.argv[2];

if (!version) {
  console.error("用法: node scripts/grow-bot-bump-version.mjs <version>  例: 0.2.7 / 0.2.7-grow-bot.1");
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`版本号不合法: ${version}`);
  process.exit(1);
}

const files = [join(repo, "app/package.json"), join(repo, "ds-bot/package.json")];
const before = [];
for (const file of files) {
  const json = JSON.parse(readFileSync(file, "utf8"));
  before.push(`${file.replace(repo + "/", "")}: ${json.version}`);
  json.version = version;
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  console.log(`${file.replace(repo + "/", "")}: -> ${version}`);
}

console.log("\n改动前:\n  " + before.join("\n  "));
console.log(`
下一步:
  1. cd ds-bot && npm test && node scripts/build-client.mjs --check && npm run lint
  2. cd app && env -u ELECTRON_RUN_AS_NODE npm test
  3. 在 CHANGELOG.md 记录本次变更, 把 Unreleased 改为 ${version}
  4. scripts/grow-bot-backup.sh "release ${version}"
  5. 构建安装: ../rebuild-grow-bot.sh
  6. 通过后: git tag -a grow-bot-v${version} -m "Grow Bot ${version}"
`);
