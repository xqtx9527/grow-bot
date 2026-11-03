import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addedPlugins, REVIEWED_PLUGINS } from '../src/client/library-catalog.js'

test('only plugins the user added are listed', () => {
  const bundles = [
    { name: 'ds-bot', installed: true, official: false },
    { name: '@deepseek-ai/dsh-voice', installed: true, official: true },
    { name: 'dsh-image-gen', installed: true, official: false },
    { name: 'left-behind', installed: false, official: false },
  ]
  assert.deepEqual(addedPlugins(bundles).map(bundle => bundle.name), ['dsh-image-gen'])
})

test('a reviewed plugin installs at the exact version that was reviewed', () => {
  for (const entry of REVIEWED_PLUGINS) assert.match(entry.spec, /^[^@]+@\d+\.\d+\.\d+$/)
})
