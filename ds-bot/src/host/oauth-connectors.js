// Connectors beyond GitHub: the built-in services and any the user adds by address. Each is
// mounted through DSH's MCP client as mcp__<id>__<tool>, like GitHub. Their tokens are secrets
// no Bot's shell can read, and reach the service only in MCP request headers.
import { startZsxqLogin } from './zsxq-cli.js'
import { startGetNoteLogin } from './connector-device-login.js'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { CLI_SESSION, domesticConfig, validateDomesticToken } from './domestic-connectors.js'
import { authorizationUrl, discover, exchangeCode, inspectAuth, pkcePair, randomState, refreshTokens, registerClient } from './connector-oauth.js'

export const CATALOG = [
  { id: 'getnote', name: 'GetNote', url: 'https://www.biji.com/openapi', auth: 'device', guide: 'https://www.biji.com/openapi' },
  { id: 'baidu-netdisk', name: 'Baidu Netdisk', url: 'https://mcp-pan.baidu.com/sse', auth: 'netdisk-login', guide: 'https://github.com/baidu-netdisk/mcp#使用准备' },
  { id: 'zsxq', name: 'ZSXQ', url: 'https://wx.zsxq.com/', auth: 'device', guide: 'https://wx.zsxq.com/' },
  { id: 'feishu', name: 'Feishu', url: 'https://mcp.feishu.cn/mcp', auth: 'oauth' },
  // Tencent's client registration takes only clients it has listed, so this one uses the personal token.
  { id: 'tencent-meeting', name: 'Tencent Meeting', url: 'https://mcp.meeting.tencent.com/mcp/wemeet-open/v1', auth: 'token', tokenHeader: 'X-Tencent-Meeting-Token', guide: 'https://meeting.tencent.com/ai-skill.html' },
  { id: 'gmail', name: 'Gmail', url: 'https://gmailmcp.googleapis.com/mcp/v1', auth: 'oauth-client', guide: 'https://developers.google.com/workspace/gmail/api/guides/configure-mcp-server' },
  { id: 'notion', name: 'Notion', url: 'https://mcp.notion.com/mcp', auth: 'oauth' },
]
const MCP_CLIENT = '@deepseek-ai/dsh-mcp-client'
const SIGN_IN_MS = 5 * 60_000
const RENEW_CHECK_MS = 60_000
const RENEW_BEFORE_MS = 5 * 60_000

const ICON_BYTES = 64 * 1024
const ICON_DATA = /^data:image\/(?:png|jpeg|webp|gif|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,[A-Za-z0-9+/=]+$/
const AUTHS = ['oauth', 'oauth-client', 'token', 'none']
const RESERVED = ['github', ...CATALOG.map(entry => entry.id)]

const secretOf = (id, part) => `${id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_CONNECTOR_${part}`
const invalid = message => Object.assign(new Error(message), { code: 'bot/invalid' })

// The site's name from its address: mcp.linear.app is Linear.
export function nameFrom(url) {
  const parts = new URL(url).hostname.split('.').filter(part => !['mcp', 'api', 'www', 'app'].includes(part))
  const word = parts.at(-2) ?? parts[0] ?? 'Connector'
  return word[0].toUpperCase() + word.slice(1)
}

// A serverName DSH takes: letters, digits and dashes, and free among the connectors.
export function idFrom(name, taken) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'connector'
  let id = /^[a-z]/.test(base) ? base : `c-${base}`
  for (let index = 2; taken.includes(id); index += 1) id = `${base}-${index}`
  return id
}

function checkUrl(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  let url
  try { url = new URL(text) } catch { throw invalid('Enter the address of an MCP server') }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw invalid('Connector addresses must start with https://')
  return url.toString().replace(/\/$/, '')
}

// The site's icon, read once when a connector is added: from the service's host, then the
// site above it. A site without one simply has none.
async function iconOf(url, request) {
  const { hostname, protocol } = new URL(url)
  const site = hostname.split('.').slice(-2).join('.')
  for (const host of new Set([hostname, site, `www.${site}`])) {
    for (const path of ['/apple-touch-icon.png', '/favicon.ico']) {
      try {
        const response = await request(`${protocol}//${host}${path}`, { signal: AbortSignal.timeout(4000) })
        const type = (response.headers.get('content-type') ?? '').split(';')[0].trim()
        if (!response.ok || !type.startsWith('image/')) continue
        const bytes = Buffer.from(await response.arrayBuffer())
        const data = `data:${type};base64,${bytes.toString('base64')}`
        if (bytes.length > 0 && bytes.length <= ICON_BYTES && ICON_DATA.test(data)) return data
      } catch { /* the next address may have it */ }
    }
  }
  return undefined
}
const page = text => `<!doctype html><meta charset="utf-8"><title>Grow Bot</title><body style="font:16px system-ui;text-align:center;padding:64px">${text}`

export function install(rt) {
  const { ctx, state } = rt
  const builtIn = rt.config.connectors === false ? [] : (rt.config.connectorCatalog ?? CATALOG)
  const entries = () => (rt.config.connectors === false ? [] : [...builtIn, ...(state.customConnectors ?? [])])
  const request = rt.config.connectorFetch ?? fetch
  const live = new Map()
  const slotOf = (id) => {
    if (!live.has(id)) live.set(id, { mount: null, status: { state: 'off' }, queue: Promise.resolve() })
    return live.get(id)
  }
  const attempts = new Map()
  let stopped = false

  const entryOf = (id) => {
    const entry = entries().find(item => item.id === id)
    if (entry === undefined) throw new Error('No such connector')
    return entry
  }
  const record = id => state.connectors?.[id]
  const reason = error => rt.redactSecrets([error, error?.cause].filter(Boolean).map(part => String(part?.message ?? part)).join(': ') || 'error').slice(0, 300)

  const unmount = async (slot) => {
    const fiber = slot.mount?.fiber
    slot.mount = null
    if (fiber !== undefined) await Promise.resolve().then(() => fiber.dispose()).catch(() => {})
  }

  async function reconcile(entry, force) {
    const slot = slotOf(entry.id)
    const open = entry.auth === 'none' && record(entry.id) !== undefined
    const token = stopped ? undefined : open ? '' : rt.secretValue(secretOf(entry.id, 'TOKEN'))
    if (!force && slot.mount !== null && slot.mount.token === token) return
    await unmount(slot)
    if (token === undefined) { slot.status = { state: 'off' }; return }
    slot.status = { state: 'connecting' }
    const loader = ctx.get?.('loader')
    if (typeof loader?.import !== 'function' || typeof ctx.plugin !== 'function') {
      slot.mount = { token }
      slot.status = { state: 'error', error: 'This DSH cannot load connectors' }
      return
    }
    try {
      const exports = await loader.import(MCP_CLIENT)
      const plugin = loader.unwrapExports?.(exports) ?? exports?.default ?? exports
      const config = domesticConfig(entry.id, token, record(entry.id)?.clientId, fileURLToPath(new URL('./domestic-mcp.js', import.meta.url)))
      const fiber = ctx.plugin(plugin, config ?? { transport: 'streamable-http', serverName: entry.id, url: entry.url, headers: token === '' ? {} : { [entry.tokenHeader ?? 'Authorization']: entry.tokenHeader ? token : `Bearer ${token}` }, failOnStartupError: true })
      slot.mount = { token, fiber }
      await fiber.await()
      if (slot.mount?.fiber === fiber) slot.status = { state: 'ready' }
    } catch (error) {
      await unmount(slot)
      slot.mount = { token }
      slot.status = { state: 'error', error: reason(error) }
      rt.warn('ds-bot: %s connector failed: %s', entry.id, slot.status.error)
    }
  }

  const sync = (entry, force = false) => {
    const slot = slotOf(entry.id)
    slot.queue = slot.queue.then(() => reconcile(entry, force)).catch(error => { rt.warn('ds-bot: connectors: %s', reason(error)) })
    return slot.queue
  }

  const keep = (id, part, value) => rt.secretEndpoint('secret-set', { name: secretOf(id, part), value, purpose: `${entryOf(id).name} connector`, scope: [] })
  const drop = async (id, part) => { if (rt.secretValue(secretOf(id, part)) !== undefined) await rt.secretEndpoint('secret-delete', { name: secretOf(id, part) }) }

  async function saveTokens(id, tokens, details) {
    if (tokens.refreshToken !== undefined) await keep(id, 'REFRESH', tokens.refreshToken)
    await keep(id, 'TOKEN', tokens.accessToken)
    const { expiresAt, ...kept } = { ...record(id), ...details }
    state.connectors = { ...state.connectors, [id]: { ...kept, ...(tokens.expiresAt === undefined ? {} : { expiresAt: tokens.expiresAt }) } }
    await rt.save()
  }

  // A token near its end is renewed and mounted again; one the service refuses needs a new sign-in.
  async function renew(entry) {
    const details = record(entry.id)
    const refreshToken = rt.secretValue(secretOf(entry.id, 'REFRESH'))
    if (details?.tokenEndpoint === undefined || refreshToken === undefined) return
    const clientSecret = rt.secretValue(secretOf(entry.id, 'CLIENT_SECRET'))
    const client = { clientId: details.clientId, ...(clientSecret === undefined ? {} : { clientSecret }) }
    try {
      await saveTokens(entry.id, await refreshTokens(details.tokenEndpoint, client, { refreshToken, resource: details.resource }, { fetch: request }), {})
    } catch (error) {
      if (error?.code !== 'refused') return
      slotOf(entry.id).status = { state: 'error', error: 'Sign in again' }
      await drop(entry.id, 'TOKEN')
      await drop(entry.id, 'REFRESH')
    }
  }

  const renewDue = async (force = false) => {
    await Promise.all(entries().filter((entry) => {
      const expiresAt = record(entry.id)?.expiresAt
      return rt.secretValue(secretOf(entry.id, 'TOKEN')) !== undefined && expiresAt !== undefined && (force || expiresAt - Date.now() < RENEW_BEFORE_MS)
    }).map(renew))
  }

  function endAttempt(id) {
    const attempt = attempts.get(id)
    if (attempt === undefined) return
    attempts.delete(id)
    clearTimeout(attempt.timer)
    attempt.server.close()
    attempt.server.closeAllConnections?.()
  }

  // A one-use listener on this machine takes the service's answer, as native apps do.
  function listen() {
    return new Promise((resolve, reject) => {
      const server = createServer()
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => { resolve({ server, redirectUri: `http://127.0.0.1:${server.address().port}/callback` }) })
    })
  }

  async function authorize(entry, body) {
    if (attempts.has(entry.id)) attempts.get(entry.id).cancel()
    if (['getnote', 'zsxq'].includes(entry.id)) {
      const controller = new AbortController()
      const login = entry.id === 'getnote' ? await startGetNoteLogin(request, controller.signal) : await startZsxqLogin(controller.signal)
      const attempt = { server: { close: () => controller.abort() } }
      attempt.cancel = () => { controller.abort(); endAttempt(entry.id) }
      attempts.set(entry.id, attempt)
      attempt.done = login.wait().then(async result => {
        const { token, clientId } = entry.id === 'getnote' ? result : { token: CLI_SESSION }
        await keep(entry.id, 'TOKEN', token)
        state.connectors = { ...state.connectors, [entry.id]: { connectedAt: Date.now(), clientId } }
        await rt.save()
        await sync(entry, true)
      }).finally(() => endAttempt(entry.id))
      attempt.done.catch(() => {})
      return { url: login.url, userCode: login.userCode }
    }
    const server = await discover(entry.url, { fetch: request })
    const given = typeof body.clientId === 'string' ? body.clientId.trim() : ''
    if (server.needsClient && given === '') throw invalid('This service needs a client ID')
    const { server: listener, redirectUri } = await listen()
    try {
      const client = server.needsClient
        ? { clientId: given, ...(typeof body.clientSecret === 'string' && body.clientSecret.trim() !== '' ? { clientSecret: body.clientSecret.trim() } : {}) }
        : await registerClient(server, redirectUri, { fetch: request })
      const pkce = pkcePair()
      const expected = randomState()
      const attempt = { server: listener }
      attempt.done = new Promise((resolve, reject) => {
        attempt.timer = setTimeout(() => { endAttempt(entry.id); reject(new Error('The sign-in timed out')) }, SIGN_IN_MS)
        attempt.timer.unref?.()
        attempt.cancel = () => { endAttempt(entry.id); reject(new Error('The sign-in was cancelled')) }
        listener.on('request', (incoming, response) => {
          const url = new URL(incoming.url, redirectUri)
          const answer = (status, text) => { response.writeHead(status, { 'content-type': 'text/html; charset=utf-8' }); response.end(page(text)) }
          if (url.pathname !== '/callback' || url.searchParams.get('state') !== expected) return answer(400, 'This sign-in is not the one Grow Bot is waiting for.')
          const code = url.searchParams.get('code')
          if (code === null) {
            answer(200, 'The sign-in did not finish. You can close this page.')
            endAttempt(entry.id)
            return reject(new Error('The service did not finish the sign-in'))
          }
          answer(200, 'Signed in. You can close this page and go back to Grow Bot.')
          void (async () => {
            const tokens = await exchangeCode(server.token_endpoint, client, { code, redirectUri, verifier: pkce.verifier, resource: server.resource }, { fetch: request })
            if (client.clientSecret !== undefined) await keep(entry.id, 'CLIENT_SECRET', client.clientSecret)
            await saveTokens(entry.id, tokens, { clientId: client.clientId, tokenEndpoint: server.token_endpoint, resource: server.resource, connectedAt: Date.now() })
            await sync(entry)
          })().finally(() => { endAttempt(entry.id) }).then(resolve, reject)
        })
      })
      // A cancelled sign-in nobody is waiting on is not an unhandled failure.
      attempt.done.catch(() => {})
      attempts.set(entry.id, attempt)
      return { url: authorizationUrl(server, { clientId: client.clientId, redirectUri, state: expected, challenge: pkce.challenge }) }
    } catch (error) {
      listener.close()
      throw error
    }
  }

  const githubView = rt.connectorsView
  const githubEndpoint = rt.connectorEndpoint
  const githubChanged = rt.secretsChanged

  const customs = () => state.customConnectors ?? []
  const isCustom = id => customs().some(entry => entry.id === id)
  const connectorsView = () => [...githubView(), ...entries().map((entry) => {
    const { status } = slotOf(entry.id)
    return {
      id: entry.id,
      name: entry.name,
      auth: entry.auth ?? 'oauth',
      ...(entry.clientIdRequired ? { clientIdRequired: true } : {}),
      ...(entry.secretUrl ? { secretUrl: true } : {}),
      state: attempts.has(entry.id) ? 'authorizing' : status.state,
      ...(status.error === undefined ? {} : { error: status.error }),
      ...(entry.icon === undefined ? {} : { icon: entry.icon }),
      ...(entry.guide === undefined ? {} : { guide: entry.guide }),
      ...(isCustom(entry.id) ? { custom: true, host: new URL(entry.url).host } : {}),
      account: null,
    }
  })]

  async function connectOpen(entry) {
    state.connectors = { ...state.connectors, [entry.id]: { connectedAt: Date.now() } }
    await rt.save()
    await sync(entry, true)
  }

  // Secrets and records of services no longer listed: a sign-in nobody can see or end.
  async function dropStale() {
    const known = new Set(['github', ...entries().map(entry => entry.id)])
    const stale = Object.keys(state.connectors ?? {}).filter(id => !known.has(id))
    for (const id of stale) {
      for (const part of ['TOKEN', 'REFRESH', 'CLIENT_SECRET']) await drop(id, part)
      delete state.connectors[id]
    }
    if (stale.length > 0) await rt.save()
  }

  const endpoints = {
    async 'connector-authorize'(body) {
      await rt.loadSecrets()
      return authorize(entryOf(body.id), body)
    },
    async 'connector-token'(body) {
      const entry = entryOf(body.id)
      const token = typeof body.token === 'string' ? body.token.trim() : ''
      if (token === '') throw invalid('Paste a token first')
      validateDomesticToken(entry.id, token)
      const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : ''
      if (entry.clientIdRequired && !/^cli_[A-Za-z0-9_-]+$/.test(clientId)) throw invalid('Enter the Client ID from the open platform')
      await rt.loadSecrets()
      await keep(entry.id, 'TOKEN', token)
      state.connectors = { ...state.connectors, [entry.id]: { connectedAt: Date.now(), ...(entry.clientIdRequired ? { clientId } : {}) } }
      await rt.save()
      await sync(entry, true)
      return connectorsView()
    },
    async 'connector-open'(body) {
      await connectOpen(entryOf(body.id))
      return connectorsView()
    },
    async 'connector-wait'(body) {
      entryOf(body.id)
      await attempts.get(body.id)?.done
      return connectorsView()
    },
    async 'connector-cancel'(body) {
      entryOf(body.id)
      attempts.get(body.id)?.cancel()
      return connectorsView()
    },
    async 'connector-disconnect'(body) {
      const entry = entryOf(body.id)
      await rt.loadSecrets()
      for (const part of ['TOKEN', 'REFRESH', 'CLIENT_SECRET']) await drop(entry.id, part)
      if (record(entry.id) !== undefined) {
        delete state.connectors[entry.id]
        await rt.save()
      }
      slotOf(entry.id).status = { state: 'off' }
      await sync(entry)
      if (isCustom(entry.id)) {
        state.customConnectors = customs().filter(item => item.id !== entry.id)
        live.delete(entry.id)
        await rt.save()
      }
      return connectorsView()
    },
    async 'connector-retry'(body) {
      const entry = entryOf(body.id)
      await rt.loadSecrets()
      await renew(entry)
      await sync(entry, true)
      return connectorsView()
    },
  }

  // What an address needs, before anything is saved. A failure here is shown in the form.
  async function inspect(body) {
    const url = checkUrl(body.url)
    const [auth, icon] = await Promise.all([inspectAuth(url, { fetch: request }), iconOf(url, request)])
    return { url, auth, name: nameFrom(url), ...(icon === undefined ? {} : { icon }) }
  }

  async function add(body) {
    const url = checkUrl(body.url)
    if (entries().some(entry => entry.url === url)) throw invalid('This connector is already in the list')
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : ''
    if (name === '') throw invalid('Give the connector a name')
    if (!AUTHS.includes(body.auth)) throw invalid('Choose how this connector signs in')
    if (body.icon !== undefined && (typeof body.icon !== 'string' || !ICON_DATA.test(body.icon) || body.icon.length > 200_000)) throw invalid('That image is too large')
    const id = idFrom(name, [...RESERVED, ...entries().map(entry => entry.id)])
    state.customConnectors = [...customs(), { id, name, url, auth: body.auth, ...(body.icon === undefined ? {} : { icon: body.icon }) }]
    await rt.save()
    return { id, connectors: connectorsView() }
  }

  const connectorEndpoint = async (endpoint, body) => {
    if (endpoint === 'connector-inspect') return inspect(body ?? {})
    if (endpoint === 'connector-add') return add(body ?? {})
    if (entries().some(entry => entry.id === body?.id)) return endpoints[endpoint](body)
    await githubEndpoint(endpoint, body)
    return connectorsView()
  }

  ctx.effect(() => {
    stopped = false
    const timer = setInterval(() => { void renewDue().catch(error => { rt.warn('ds-bot: connectors: %s', reason(error)) }) }, RENEW_CHECK_MS)
    timer.unref?.()
    void rt.loadSecrets().then(() => rt.load?.()).then(dropStale).then(renewDue).then(() => Promise.all(entries().map(entry => sync(entry))))
    return () => {
      stopped = true
      clearInterval(timer)
      for (const id of [...attempts.keys()]) endAttempt(id)
      for (const slot of live.values()) void unmount(slot)
    }
  }, 'ds-bot: oauth connectors')

  Object.assign(rt, {
    connectorsView,
    connectorEndpoint,
    secretsChanged: () => { githubChanged(); for (const entry of entries()) void sync(entry) },
  })
}
