import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, describe, test } from 'node:test'
import { bundledNode, experimentPatch, GROW_BOT_PRESET_PATCH_NAME, reconcileGrowBotPreset } from '../src/grow-bot-preset.mjs'

// A stand-in profile: the web-app bundle inserts the standard preset, and
// `user` rows model the profile's own cordis.patch.yml.
function profile(user = []) {
  const dir = mkdtempSync(join(tmpdir(), 'ds-bot-grow-bot-preset-'))
  return {
    name: 'ds-bot', dir, patchPath: join(dir, 'cordis.patch.yml'), skippedBundles: [],
    layers: [{
      packageName: '@deepseek-ai/dsh-web-app', packageDir: '', patchPaths: [],
      patches: [{
        insert: [{
          id: 'preset-standard',
          name: '@deepseek-ai/dsh-agent-preset',
          config: { id: 'standard', order: 1, plugins: [{ id: 'tool-bash', name: '@deepseek-ai/dsh-tool-bash' }] },
        }],
      }],
    }],
    patches: user,
  }
}

function resources() {
  const dir = mkdtempSync(join(tmpdir(), 'ds-bot-grow-bot-resources-'))
  mkdirSync(join(dir, 'primary-runtime', 'dependencies', 'node', 'bin'), { recursive: true })
  writeFileSync(join(dir, 'primary-runtime', 'dependencies', 'node', 'bin', process.platform === 'win32' ? 'node.exe' : 'node'), '')
  return dir
}

describe('experimentPatch', () => {
  const made = []
  const track = (...args) => { const p = profile(...args); made.push(p.dir); return p }
  after(() => { for (const dir of made) rmSync(dir, { recursive: true, force: true }) })

  test('adds the host services and the preset rows, keeping the standard preset', () => {
    const res = resources()
    try {
      const rows = experimentPatch(track(), res)
      const insert = rows.find(row => Array.isArray(row.insert))
      assert.deepEqual(insert.insert.map(row => row.id), ['agent-team', 'worktree-service'])
      assert.equal(insert.insert[1].config.nodeCommand, join(res, 'primary-runtime', 'dependencies', 'node', 'bin', process.platform === 'win32' ? 'node.exe' : 'node'))
      const preset = rows.find(row => row.id === 'preset-standard')
      assert.deepEqual(preset.config.plugins.map(row => row.id), ['tool-bash', 'tool-worktree', 'tool-agent-team', 'session-search'])
      assert.equal(preset.config.id, 'standard')
    } finally {
      rmSync(res, { recursive: true, force: true })
    }
  })

  test('falls back to `node` when the payload is absent', () => {
    const rows = experimentPatch(track(), '/nonexistent')
    const insert = rows.find(row => Array.isArray(row.insert))
    assert.equal(insert.insert[1].config.nodeCommand, 'node')
  })

  test('does not insert a service the profile already carries', () => {
    const p = track()
    p.layers.push({ packageName: 'extra', packageDir: '', patchPaths: [], patches: [{ insert: [{ id: 'agent-team', name: '@deepseek-ai/dsh-experimental-agent-team' }] }] })
    const rows = experimentPatch(p, '/nonexistent')
    const insert = rows.find(row => Array.isArray(row.insert))
    assert.deepEqual(insert.insert.map(row => row.id), ['worktree-service'])
    assert.ok(rows.some(row => row.id === 'agent-team'))
  })

  test('replaces experiment rows a hand-written preset already has', () => {
    const user = [{ id: 'preset-standard', config: { id: 'standard', order: 1, plugins: [{ id: 'tool-worktree', name: '@deepseek-ai/dsh-experimental-tool-worktree' }] } }]
    const preset = experimentPatch(track(user), '/nonexistent').find(row => row.id === 'preset-standard')
    assert.deepEqual(preset.config.plugins.map(row => row.id), ['tool-worktree', 'tool-agent-team', 'session-search'])
  })

  test('has nothing to do without a standard preset', () => {
    const bare = { dir: mkdtempSync(join(tmpdir(), 'ds-bot-grow-bot-bare-')), layers: [], patches: [] }
    try { assert.equal(experimentPatch(bare, '/nonexistent'), undefined) } finally { rmSync(bare.dir, { recursive: true, force: true }) }
  })
})

describe('reconcileGrowBotPreset', () => {
  test('writes the overlay next to the profiles and drops it when not needed', () => {
    const p = profile()
    try {
      const [file] = reconcileGrowBotPreset(p, '/nonexistent')
      assert.equal(file, join(dirname(p.dir), GROW_BOT_PRESET_PATCH_NAME))
      assert.ok(existsSync(file))
      assert.match(readFileSync(file, 'utf8'), /tool-agent-team/)
      const bare = { dir: mkdtempSync(join(tmpdir(), 'ds-bot-grow-bot-bare-')), layers: [], patches: [] }
      try {
        assert.deepEqual(reconcileGrowBotPreset(bare, '/nonexistent'), [])
        assert.equal(existsSync(join(dirname(bare.dir), GROW_BOT_PRESET_PATCH_NAME)), false)
      } finally {
        rmSync(bare.dir, { recursive: true, force: true })
      }
    } finally {
      rmSync(p.dir, { recursive: true, force: true })
    }
  })

  test('bundledNode reports the payload Node beside the asar when present', () => {
    const res = resources()
    try { assert.match(bundledNode(res), /primary-runtime.dependencies.node.bin.node/) } finally { rmSync(res, { recursive: true, force: true }) }
  })
})
