// The vault: saved sign-ins and cards, sealed on disk with the keychain's key. A
// password never reaches a model: a Bot asks for a sign-in, and the browser tool types it into
// the page itself. It goes only to the site it was saved for, over https, and a Bot needs the
// user's yes the first time. Passwords and card numbers also join the redaction every model
// request passes. A card is for the user alone: no tool reads it, and payments stay theirs.
import { randomUUID } from 'node:crypto'
import { chmod, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { replaceFile } from './files.js'
import { isSealed, seal, unseal, vaultKey } from './vault-crypto.js'

const KINDS = ['login', 'card']
const MAX_TEXT = 2000
const invalid = message => Object.assign(new Error(message), { code: 'bot/invalid' })
const text = value => (typeof value === 'string' ? value.trim().slice(0, MAX_TEXT) : '')

/** The host of a site as typed: an address or a bare name, without its www. */
export function siteOf(value) {
  const raw = text(value)
  let host
  try { host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`).hostname } catch { throw invalid('Enter the site, like accounts.google.com') }
  if (!host.includes('.')) throw invalid('Enter the site, like accounts.google.com')
  return host.toLowerCase().replace(/^www\./, '')
}

const sitesOf = item => (Array.isArray(item.sites) && item.sites.length > 0 ? item.sites : [item.site])

/** The rows of a CSV: quotes, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(source) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  const input = String(source ?? '').replace(/^\uFEFF/, '')
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { cell += '"'; index += 1 } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(cell); cell = '' } else if (char === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = '' } else cell += char
  }
  if (cell !== '' || row.length > 0) { row.push(cell.replace(/\r$/, '')); rows.push(row) }
  return rows
}

/** The logins of a browser's password export (Chrome, Edge, Safari, Firefox). */
export function parseLogins(source) {
  const [head, ...rows] = parseCsv(source)
  const names = (head ?? []).map(name => name.trim().toLowerCase())
  const at = (...wanted) => names.findIndex(name => wanted.includes(name))
  const [url, username, password, note] = [at('url', 'website', 'login_uri'), at('username', 'login_username'), at('password', 'login_password'), at('note', 'notes')]
  if (url < 0 || password < 0) throw invalid('This file has no url and password columns')
  const logins = []
  let skipped = 0
  for (const row of rows) {
    try {
      if (!row[password]) throw new Error('empty')
      logins.push({ site: siteOf(row[url]), username: row[username] ?? '', password: row[password], hint: note >= 0 ? row[note] ?? '' : '' })
    } catch { skipped += 1 }
  }
  return { logins, skipped }
}

/** Whether a login saved for `site` may be typed into a page on `host`. */
export const siteMatches = (site, host) => host === site || host.endsWith(`.${site}`)

export function install(rt) {
  const { home } = rt
  const path = join(home, 'vault.json')
  const key = vaultKey(rt.config)
  const items = new Map()
  let loaded = null
  let blocked

  const read = async () => {
    let contents
    try { contents = await readFile(path, 'utf8') } catch (error) {
      if (error?.code !== 'ENOENT') blocked = error?.code ?? 'error'
      return
    }
    try {
      const record = JSON.parse(contents)
      if (!isSealed(record) || key === undefined) throw new Error('sealed')
      const stored = JSON.parse(unseal(key, record)).items
      for (const item of stored) if (KINDS.includes(item.kind)) items.set(item.id, item)
      blocked = undefined
      // Contact details are gone from the vault, so they leave the disk too.
      if (items.size < stored.length) await save()
    } catch { blocked = 'locked' }
    rt.secretsRefresh?.()
  }
  const load = () => (loaded ??= read())
  const save = async () => {
    if (key === undefined) throw invalid('The vault needs the desktop app')
    if (blocked !== undefined) throw invalid('The vault could not be opened')
    await mkdir(home, { recursive: true })
    const temp = `${path}.${randomUUID()}.tmp`
    try {
      await writeFile(temp, JSON.stringify(seal(key, JSON.stringify({ items: [...items.values()] }))), { encoding: 'utf8', mode: 0o600 })
      await chmod(temp, 0o600)
      await replaceFile(temp, path)
    } catch (error) {
      await unlink(temp).catch(() => {})
      throw error
    }
    rt.secretsRefresh?.()
    await rt.save()
  }

  // What the window sees: never a password.
  const vaultView = () => ({
    available: key !== undefined && blocked === undefined,
    items: [...items.values()].map(({ password, number, securityCode, allowedBots, ...shown }) => ({
      ...shown,
      ...(shown.kind === 'login' ? { sites: sitesOf(shown), hasPassword: Boolean(password), allowedBots: allowedBots ?? [] } : {}),
      ...(shown.kind === 'card' ? { last4: String(number).slice(-4), hasSecurityCode: Boolean(securityCode) } : {}),
    })),
  })

  function itemFrom(body, previous) {
    const kind = previous?.kind ?? body.kind
    if (!KINDS.includes(kind)) throw invalid('Choose what to save')
    const base = { id: previous?.id ?? randomUUID(), kind, createdAt: previous?.createdAt ?? Date.now(), updatedAt: Date.now() }
    if (kind === 'card') {
      const number = text(body.number).replace(/[\s-]/g, '') || previous?.number
      if (!/^\d{12,19}$/.test(number ?? '')) throw invalid('Enter the card number')
      const expiry = text(body.expiry)
      if (!/^(0[1-9]|1[0-2])\s*\/\s*\d{2}(\d{2})?$/.test(expiry)) throw invalid('Enter the expiry as MM / YY')
      return { ...base, number, expiry, securityCode: text(body.securityCode) || previous?.securityCode || '', holder: text(body.holder), nickname: text(body.nickname), billingAddress: text(body.billingAddress), hint: text(body.hint) }
    }
    const sites = [...new Set((Array.isArray(body.sites) ? body.sites : [body.site]).filter(value => text(value) !== '').map(siteOf))]
    if (sites.length === 0) throw invalid('Enter the site, like accounts.google.com')
    const password = typeof body.password === 'string' && body.password !== '' ? body.password : previous?.password
    if (!password) throw invalid('Enter the password')
    // A changed password or site starts over: a Bot asks again.
    const same = previous && sitesOf(previous).join() === sites.join() && previous.password === password
    return { ...base, site: sites[0], sites, username: text(body.username), password, hint: text(body.hint), allowedBots: same ? previous.allowedBots ?? [] : [] }
  }

  async function vaultEndpoint(endpoint, body = {}) {
    await load()
    if (endpoint === 'vault-save') {
      const item = itemFrom(body, typeof body.id === 'string' ? items.get(body.id) : undefined)
      items.set(item.id, item)
    } else if (endpoint === 'vault-delete') {
      items.delete(String(body.id))
    } else if (endpoint === 'vault-reveal') {
      const item = items.get(String(body.id))
      if (item?.kind !== 'card') throw invalid('Only a card can be shown')
      return { number: item.number, securityCode: item.securityCode }
    } else if (endpoint === 'vault-import') {
      const { logins, skipped } = parseLogins(body.csv)
      const known = new Set([...items.values()].filter(item => item.kind === 'login').map(item => `${item.site}|${item.username}`))
      let added = 0
      for (const login of logins) {
        const entry = itemFrom({ kind: 'login', ...login })
        if (known.has(`${entry.site}|${entry.username}`)) continue
        items.set(entry.id, entry)
        known.add(`${entry.site}|${entry.username}`)
        added += 1
      }
      await save()
      return { ...vaultView(), imported: { added, skipped } }
    } else if (endpoint === 'vault-revoke') {
      const item = items.get(String(body.id))
      if (item) item.allowedBots = (item.allowedBots ?? []).filter(id => id !== body.botId)
    }
    await save()
    return vaultView()
  }

  // A sign-in for this page, for the browser tool only. https, and the site it was saved for.
  async function loginsFor(url) {
    await load()
    let page
    try { page = new URL(url) } catch { return [] }
    if (page.protocol !== 'https:') return []
    const host = page.hostname.toLowerCase().replace(/^www\./, '')
    return [...items.values()].filter(item => item.kind === 'login' && sitesOf(item).some(site => siteMatches(site, host)))
  }

  // What a Bot may read to choose a login: never the password.
  const vaultLogins = async url => (await loginsFor(url)).map(item => ({ account: item.username, hint: item.hint ?? '' }))

  async function vaultLogin(url, account) {
    const fits = await loginsFor(url)
    const wanted = text(account).toLowerCase()
    return wanted === '' ? fits[0] : fits.find(item => item.username.toLowerCase() === wanted)
  }

  async function vaultAllow(id, botId) {
    const item = items.get(id)
    if (!item) return
    item.allowedBots = [...new Set([...(item.allowedBots ?? []), botId])]
    await save()
  }

  rt.ctx.effect?.(() => { void load(); return undefined }, 'ds-bot: vault')
  Object.assign(rt, {
    vaultView,
    vaultEndpoint,
    vaultLogin,
    vaultLogins,
    vaultAllow,
    vaultValues: () => [...items.values()].flatMap(item => [
      ...(item.password ? [{ name: `VAULT_${item.site}`, value: item.password }] : []),
      ...(item.number ? [{ name: 'VAULT_CARD', value: item.number }] : []),
    ]),
  })
}
