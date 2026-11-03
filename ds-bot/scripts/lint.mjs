// Lint with the oxlint that `npm run harness` installs in dev/harness, or that a
// deepseek-harness checkout installs, so ds-bot needs no copy of its own. The places are
// DSH_HARNESS, else dev/harness, else a checkout beside this checkout, else beside the main
// worktree (a git worktree has no deepseek-harness of its own).
// Usage: npm run lint [-- <oxlint options>]
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const plugin = resolve(import.meta.dirname, '..')
const candidates = [process.env.DSH_HARNESS, join(plugin, 'dev', 'harness'), join(plugin, '..', 'deepseek-harness')]
try {
  const common = execFileSync('git', ['-C', plugin, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim()
  candidates.push(join(dirname(common), 'deepseek-harness'))
} catch {}
// Node runs oxlint's own script: on Windows it cannot spawn the .cmd shim in node_modules/.bin
// without a shell.
const bin = candidates.filter(Boolean).map(dir => join(dir, 'node_modules', 'oxlint', 'bin', 'oxlint')).find(existsSync)
if (!bin) {
  console.error('lint: no oxlint found; run npm run harness, or set DSH_HARNESS to a deepseek-harness checkout')
  process.exit(2)
}
// oxlint takes no path with `..`, so the desktop app runs from its own folder.
const config = join(plugin, '.oxlintrc.json')
const lint = (cwd, paths) => {
  const result = spawnSync(process.execPath, [bin, '-c', config, ...process.argv.slice(2), ...paths], { cwd, stdio: 'inherit' })
  if (result.error) console.error(`lint: ${result.error.message}`)
  return result.status ?? 1
}
const plain = lint(plugin, ['index.js', 'web-search.js', 'src', 'dev', 'scripts', 'test'])
const desktop = lint(resolve(plugin, '..', 'app'), ['src', 'test', 'scripts'])
process.exit(plain || desktop)
