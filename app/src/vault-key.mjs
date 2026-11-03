// The vault's key: random, kept encrypted by the system keychain beside the app's own data.
// A throwaway run (DS_BOT_HOME) gets a key of its own, so it never asks the keychain.
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'

const NAME = 'GROW_BOT_VAULT_KEY'

export function vaultKeyEnv() {
  if (process.env.DS_BOT_HOME) return { [NAME]: randomBytes(32).toString('base64') }
  try {
    if (!safeStorage.isEncryptionAvailable()) return {}
    const file = join(app.getPath('userData'), 'vault.key')
    if (existsSync(file)) return { [NAME]: safeStorage.decryptString(readFileSync(file)) }
    const key = randomBytes(32).toString('base64')
    writeFileSync(file, safeStorage.encryptString(key), { mode: 0o600 })
    return { [NAME]: key }
  } catch (error) {
    console.error('Grow Bot: the vault key is not available:', error?.message ?? error)
    return {}
  }
}
