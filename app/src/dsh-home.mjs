// What the app reads of a DSH home: where the user's own one is, and whether a DSH holds one.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir, hostname } from 'node:os'
import { join, resolve } from 'node:path'

const LOCK_STALE_MS = 60_000

/** The DSH home of the user's own DSH, read as DSH reads DSH_HOME. */
export function userDshHome(env = process.env) {
  const value = env.DSH_HOME?.trim()
  if (!value) return join(homedir(), '.dsh')
  return resolve(value === '~' ? homedir() : /^~[\\/]/u.test(value) ? join(homedir(), value.slice(2)) : value)
}

/** Whether a running DSH holds the team, as ds-bot's own lock tells (src/host/home-lock.js). */
export function teamInUse(from, { host = hostname(), now = Date.now() } = {}) {
  const path = join(from, 'bot', 'state.lock')
  if (!existsSync(path)) return false
  const fresh = now - statSync(path).mtimeMs < LOCK_STALE_MS
  let holder
  try {
    holder = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fresh
  }
  if (holder?.host !== host) return fresh
  try {
    process.kill(holder.pid, 0)
    return true
  } catch (error) {
    return error?.code === 'EPERM'
  }
}
