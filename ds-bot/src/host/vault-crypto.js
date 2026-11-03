// Sealing for what the vault and the secrets file keep on disk. The desktop app holds the key
// in the system keychain and hands it to this process; nothing writes it to a file in the clear.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const KEY_SLOT = Symbol.for('grow-bot.vault-key')
const ALGORITHM = 'aes-256-gcm'

/** The 32-byte key for this process, or undefined where there is no keychain behind it. */
export function vaultKey(config = {}) {
  const value = config.vaultKey ?? globalThis[KEY_SLOT]
  const key = typeof value === 'string' ? Buffer.from(value, 'base64') : value
  return Buffer.isBuffer(key) && key.length === 32 ? key : undefined
}

export const isSealed = value => value?.sealed === 1 && typeof value.data === 'string'

export function seal(key, text) {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return { sealed: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') }
}

/** The text a sealed record holds; throws when the key is wrong or the record was changed. */
export function unseal(key, record) {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(record.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(record.data, 'base64')), decipher.final()]).toString('utf8')
}
