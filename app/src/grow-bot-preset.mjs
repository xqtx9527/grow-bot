// P4 experiments the app ships on purpose: in-session Agent Teams, the
// cross-session search tools behind chain-of-recall, and the Git worktree tool.
// They live in the Bot agent preset, which no profile layer of ours owns: the
// window profile is DSH's own standard preset plus this app's bundles, so the
// Host adds the rows through a `--patch` overlay it writes into its own data
// area next to the profiles (`<DSH_HOME>/profiles/grow-bot-preset.patch.yml`).
// DSH reads that file only through `patchFiles`, so it never rewrites the
// profile. The worktree service runs the app's own Node, because the app's
// PATH has no `node` on a machine that only runs the packaged build.
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { composeEntries } from '@deepseek-ai/dsh-app-boot'
import { stringify } from 'yaml'

export const GROW_BOT_PRESET_PATCH_NAME = 'grow-bot-preset.patch.yml'

const PRESET_ID = 'preset-standard'
const EXPERIMENT_IDS = new Set(['tool-worktree', 'tool-agent-team', 'session-search'])

// Rows inside the Bot agent preset.
const PRESET_ROWS = [
  { id: 'tool-worktree', name: '@deepseek-ai/dsh-experimental-tool-worktree' },
  { id: 'tool-agent-team', name: '@deepseek-ai/dsh-experimental-tool-agent-team' },
  {
    id: 'session-search',
    name: 'cordis:group',
    group: true,
    isolate: { sessionQuery: true },
    config: [
      { id: 'optional-session-query-sqlite', name: '@deepseek-ai/dsh-session-query-sqlite', config: { path: ':memory:', openAt: 'first-search' } },
      { id: 'optional-tool-session-query', name: '@deepseek-ai/dsh-tool-session-query' },
    ],
  },
]

// Services the preset rows inject, mounted on the host plane.
const HOST_ROWS = [
  { id: 'agent-team', name: '@deepseek-ai/dsh-experimental-agent-team' },
  { id: 'worktree-service', name: '@deepseek-ai/dsh-experimental-worktree' },
]

/** The app's own Node, or `node` when the payload is absent (a development run). */
export function bundledNode(resourcesDir) {
  const node = join(resourcesDir, 'primary-runtime', 'dependencies', 'node', 'bin', process.platform === 'win32' ? 'node.exe' : 'node')
  return existsSync(node) ? node : 'node'
}

/**
 * The overlay rows for one launch, or `undefined` when the profile has no
 * standard preset to extend.
 * @param {import('@deepseek-ai/dsh-app-boot').Profile} profile
 * @param {string} resourcesDir - The packaged app's resources directory.
 */
export function experimentPatch(profile, resourcesDir) {
  const entries = composeEntries([...profile.layers.map(layer => layer.patches), profile.patches])
  const preset = entries.find(entry => entry.id === PRESET_ID)
  if (preset === undefined) return undefined
  const plugins = [...(preset.config?.plugins ?? [])].filter(row => !EXPERIMENT_IDS.has(row.id))
  plugins.push(...PRESET_ROWS)
  const host = HOST_ROWS.map(row => ({ ...row, ...(row.id === 'worktree-service' ? { config: { nodeCommand: bundledNode(resourcesDir) } } : {}) }))
  // Rows the profile already carries (an older install, a hand-written patch)
  // are overridden by id instead of inserted a second time.
  const present = new Set(entries.map(entry => entry.id))
  const insert = host.filter(row => !present.has(row.id))
  const override = host.filter(row => present.has(row.id))
  return [
    ...(insert.length === 0 ? [] : [{ insert }]),
    ...override,
    { id: PRESET_ID, config: { ...(preset.config ?? {}), plugins } },
  ]
}

/**
 * Write the overlay next to the profiles and report it for `patchFiles`; when
 * the profile has no standard preset, drop a stale one from an earlier launch.
 * @param {import('@deepseek-ai/dsh-app-boot').Profile} profile
 * @param {string} resourcesDir
 * @returns {string[]} the `patchFiles` argument for this launch
 */
export function reconcileGrowBotPreset(profile, resourcesDir) {
  const file = join(dirname(profile.dir), GROW_BOT_PRESET_PATCH_NAME)
  const rows = experimentPatch(profile, resourcesDir)
  if (rows === undefined) {
    rmSync(file, { force: true })
    return []
  }
  writeFileSync(file, stringify(rows), 'utf8')
  return [file]
}
