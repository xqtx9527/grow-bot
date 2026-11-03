import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import { teamInUse, userDshHome } from '../src/dsh-home.mjs'

const from = mkdtempSync(join(tmpdir(), 'ds-bot-dsh-home-'))
after(() => { rmSync(from, { recursive: true, force: true }) })
const write = (path, text) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

test('takes the team for in use while a live process on this machine or a fresh lock elsewhere holds it', () => {
  const lock = join(from, 'bot', 'state.lock')
  write(lock, JSON.stringify({ pid: process.pid, host: 'here' }))
  assert.equal(teamInUse(from, { host: 'here' }), true)
  const ended = spawnSync(process.execPath, ['-e', '']).pid
  write(lock, JSON.stringify({ pid: ended, host: 'here' }))
  assert.equal(teamInUse(from, { host: 'here' }), false)
  write(lock, JSON.stringify({ pid: 1, host: 'elsewhere' }))
  assert.equal(teamInUse(from, { host: 'here' }), true)
  const old = new Date(Date.now() - 120_000)
  utimesSync(lock, old, old)
  assert.equal(teamInUse(from, { host: 'here' }), false)
})

test('reads DSH_HOME as DSH does', () => {
  assert.equal(userDshHome({}), join(homedir(), '.dsh'))
  assert.equal(userDshHome({ DSH_HOME: ' ' }), join(homedir(), '.dsh'))
  assert.equal(userDshHome({ DSH_HOME: '~/dsh-x' }), join(homedir(), 'dsh-x'))
})
