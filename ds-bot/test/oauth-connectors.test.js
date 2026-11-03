import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { apply } from '../index.js'
import { CATALOG, idFrom, nameFrom } from '../src/host/oauth-connectors.js'
import { authorizationUrl, discover, inspectAuth, pkcePair, registerClient } from '../src/host/connector-oauth.js'
import { fakeContext } from './fake-ctx.js'

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
const MCP = 'https://mcp.test/mcp'
const AS = 'https://auth.test'
const SERVER = { authorization_endpoint: `${AS}/authorize`, token_endpoint: `${AS}/token`, registration_endpoint: `${AS}/register`, code_challenge_methods_supported: ['S256'] }

// A service: its 401 names its metadata; `tokens` answers each grant in turn.
function service({ registered = true, tokens = [] } = {}) {
  const calls = []
  const request = async (url, init = {}) => {
    const address = String(url)
    calls.push({ url: address, init })
    if (address === MCP) return json({}, 401, { 'www-authenticate': `Bearer resource_metadata="${MCP}/meta"` })
    if (address === `${MCP}/meta`) return json({ resource: MCP, authorization_servers: [AS] })
    if (address === `${AS}/.well-known/oauth-authorization-server`) return json(registered ? SERVER : { ...SERVER, registration_endpoint: undefined })
    if (address === `${AS}/register`) return json({ client_id: 'client-1' })
    if (address === `${AS}/token`) return json(tokens.shift() ?? {}, 200)
    return json({}, 404)
  }
  return { calls, request }
}

test('the service is found from the address its 401 names', async () => {
  const { request } = service()
  const found = await discover(MCP, { fetch: request })
  assert.equal(found.token_endpoint, `${AS}/token`)
  assert.equal(found.resource, MCP)
  assert.deepEqual(await registerClient(found, 'http://127.0.0.1:1/callback', { fetch: request }), { clientId: 'client-1' })
})

test('an address is told apart by how it signs in', async () => {
  assert.equal(await inspectAuth(MCP, { fetch: service().request }), 'oauth')
  assert.equal(await inspectAuth(MCP, { fetch: service({ registered: false }).request }), 'oauth-client')
  assert.equal(await inspectAuth(MCP, { fetch: async () => json({}, 401) }), 'token')
  assert.equal(await inspectAuth(MCP, { fetch: async (url, init) => (init?.method === 'POST' ? json({}) : json({}, 404)) }), 'none')
  await assert.rejects(inspectAuth(MCP, { fetch: async (url, init) => (init?.method === 'POST' ? json({}, 500) : json({}, 404)) }), /may not be an MCP server/)
  await assert.rejects(inspectAuth(MCP, { fetch: async () => { throw new Error('down') } }), /Could not reach/)
})

test('Google gets no resource parameter and is asked for a refresh token', async () => {
  const google = 'https://accounts.google.com'
  const request = async (url) => {
    const address = String(url)
    if (address.endsWith('/oauth-protected-resource/mcp')) return json({ resource: MCP, authorization_servers: [`${google}/`], scopes_supported: ['mail'] })
    if (address === `${google}/.well-known/openid-configuration`) return json({ authorization_endpoint: `${google}/auth`, token_endpoint: `${google}/token` })
    return json({}, 404)
  }
  const server = await discover(MCP, { fetch: request })
  assert.equal(server.needsClient, true)
  const url = new URL(authorizationUrl(server, { clientId: 'c', redirectUri: 'http://127.0.0.1:1/callback', state: 's', challenge: 'x' }))
  assert.equal(url.searchParams.has('resource'), false)
  assert.equal(url.searchParams.get('access_type'), 'offline')
  assert.equal(url.searchParams.get('prompt'), 'consent')
})

test('a name and a free id come from the address', () => {
  assert.equal(nameFrom('https://mcp.linear.app/mcp'), 'Linear')
  assert.equal(nameFrom('https://api.example.com/v1'), 'Example')
  assert.equal(idFrom('My Tool!', []), 'my-tool')
  assert.equal(idFrom('Notion', ['notion']), 'notion-2')
  assert.equal(idFrom('123', []), 'c-123')
})

test('the sign-in address carries PKCE, the state and the resource', () => {
  const { challenge } = pkcePair()
  const url = new URL(authorizationUrl({ ...SERVER, resource: MCP, scopes: ['read', 'write'] }, { clientId: 'c', redirectUri: 'http://127.0.0.1:1/callback', state: 's', challenge }))
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(url.searchParams.get('code_challenge'), challenge)
  assert.equal(url.searchParams.get('resource'), MCP)
  assert.equal(url.searchParams.get('scope'), 'read write')
})

test('the built-in list includes domestic services, on https', () => {
  for (const entry of CATALOG) assert.match(entry.url, /^https:\/\//)
  assert.deepEqual(CATALOG.map(entry => entry.id), ['getnote', 'baidu-netdisk', 'zsxq', 'feishu', 'tencent-meeting', 'gmail', 'notion'])
})

const TEAM = { version: 1, mainBotIds: ['m1'], revision: 1, bots: { m1: { id: 'm1', sessionId: 'm1', name: 'Chief', role: '', instructions: '', createdAt: 1 } }, rooms: {}, exchanges: [], exchangeTurns: {}, questions: {} }

async function setup(t, tokens, catalog = [{ id: 'notes', name: 'Notes', url: MCP, auth: 'oauth' }]) {
  const home = mkdtempSync(join(tmpdir(), 'dsb-oauth-'))
  t.after(() => rmSync(home, { recursive: true, force: true }))
  writeFileSync(join(home, 'state.json'), JSON.stringify(TEAM))
  const mounts = []
  const plugin = { name: 'mcp-client', apply() {} }
  const loader = { import: async () => ({ default: plugin }), unwrapExports: exports => exports.default }
  const ctx = fakeContext({ services: { loader } })
  ctx.plugin = (given, config) => {
    const mount = { config, disposed: false }
    mounts.push(mount)
    return { await: async () => {}, dispose: () => { mount.disposed = true } }
  }
  const register = ctx.connection.fetch.register
  ctx.connection.fetch.register = (route) => { ctx.route = route; return register(route) }
  const { calls, request } = service({ tokens })
  apply(ctx, { home, github: false, connectorCatalog: catalog, connectorFetch: request })
  const call = async (endpoint, payload) => (await ctx.route.fetch(new Request('http://localhost/api/bot', { method: 'POST', body: JSON.stringify({ endpoint, payload }) }))).json()
  await call('state', {})
  return { home, mounts, calls, call }
}

const row = view => view.value.find(item => item.id === 'notes')
const answerFor = (signIn, fields) => {
  const target = new URL(signIn.searchParams.get('redirect_uri'))
  for (const [key, value] of Object.entries(fields)) target.searchParams.set(key, value)
  return fetch(target)
}

test('a click signs in through the browser, mounts the service and hides the token from every Bot', async (t) => {
  const { home, mounts, calls, call } = await setup(t, [{ access_token: 'access-secret', refresh_token: 'refresh-secret', expires_in: 3600 }])
  assert.equal(row(await call('connector-wait', { id: 'notes' })).state, 'off')
  const started = await call('connector-authorize', { id: 'notes' })
  const signIn = new URL(started.value.url)
  assert.equal(signIn.origin, AS)
  const waiting = call('connector-wait', { id: 'notes' })
  // An answer that does not carry this sign-in's state is turned away, and the wait goes on.
  assert.equal((await answerFor(signIn, { code: 'stolen', state: 'wrong' })).status, 400)
  assert.equal(calls.filter(entry => entry.url === `${AS}/token`).length, 0)
  assert.equal((await answerFor(signIn, { code: 'good', state: signIn.searchParams.get('state') })).status, 200)
  assert.equal(row(await waiting).state, 'ready')
  assert.equal(mounts.length, 1)
  assert.equal(mounts[0].config.serverName, 'notes')
  assert.equal(mounts[0].config.headers.Authorization, 'Bearer access-secret')
  const grant = new URLSearchParams(String(calls.find(entry => entry.url === `${AS}/token`).init.body))
  assert.equal(grant.get('code'), 'good')
  assert.ok((grant.get('code_verifier') ?? '').length > 20)
  const saved = readFileSync(join(home, 'state.json'), 'utf8')
  assert.equal(saved.includes('access-secret') || saved.includes('refresh-secret'), false)
  const secrets = JSON.parse(readFileSync(join(home, 'secrets.json'), 'utf8'))
  const list = secrets.secrets ?? secrets
  for (const secret of list) assert.deepEqual(secret.scope, [], secret.name)

  const off = await call('connector-disconnect', { id: 'notes' })
  assert.equal(row(off).state, 'off')
  assert.equal(mounts[0].disposed, true)
  assert.equal(readFileSync(join(home, 'secrets.json'), 'utf8').includes('access-secret'), false)
})

test('Try again renews the token with the refresh token and mounts the new one', async (t) => {
  const { mounts, calls, call } = await setup(t, [
    { access_token: 'first', refresh_token: 'keep', expires_in: 3600 },
    { access_token: 'second', expires_in: 3600 },
  ])
  const signIn = new URL((await call('connector-authorize', { id: 'notes' })).value.url)
  const waiting = call('connector-wait', { id: 'notes' })
  await answerFor(signIn, { code: 'good', state: signIn.searchParams.get('state') })
  await waiting
  await call('connector-retry', { id: 'notes' })
  const grant = new URLSearchParams(String(calls.filter(entry => entry.url === `${AS}/token`).at(-1).init.body))
  assert.equal(grant.get('grant_type'), 'refresh_token')
  assert.equal(grant.get('refresh_token'), 'keep')
  assert.equal(mounts.at(-1).config.headers.Authorization, 'Bearer second')
})

test('a cancelled sign-in closes its listener and ends the wait with a clear message', async (t) => {
  const { call } = await setup(t, [])
  const signIn = new URL((await call('connector-authorize', { id: 'notes' })).value.url)
  const waiting = call('connector-wait', { id: 'notes' })
  await call('connector-cancel', { id: 'notes' })
  assert.match(JSON.stringify(await waiting), /cancelled/)
  await assert.rejects(answerFor(signIn, { code: 'late', state: 'x' }))
})

test('a connector added by address joins the list, signs in with a token, and goes when removed', async (t) => {
  const { mounts, call } = await setup(t, [])
  const url = 'https://tools.example.com/mcp'
  const added = await call('connector-add', { url, name: 'Tools', auth: 'token' })
  assert.equal(added.value.id, 'tools')
  assert.equal((await call('connector-add', { url, name: 'Again', auth: 'token' })).ok, false)
  assert.equal((await call('connector-token', { id: 'tools', token: 'tool-token' })).ok, true)
  assert.equal(mounts.at(-1).config.serverName, 'tools')
  assert.equal(mounts.at(-1).config.headers.Authorization, 'Bearer tool-token')
  const shown = (await call('state', {})).value.connectors.find(item => item.id === 'tools')
  assert.deepEqual([shown.custom, shown.host, shown.state], [true, 'tools.example.com', 'ready'])
  const gone = await call('connector-disconnect', { id: 'tools' })
  assert.equal(gone.value.some(item => item.id === 'tools'), false)
})

test('an address that needs no sign-in connects with no header, and bad input is refused', async (t) => {
  const { mounts, call } = await setup(t, [])
  await call('connector-add', { url: 'https://open.example.com/mcp', name: 'Open', auth: 'none' })
  await call('connector-open', { id: 'open' })
  assert.deepEqual(mounts.at(-1).config.headers, {})
  assert.match(JSON.stringify(await call('connector-add', { url: 'http://plain.example.com/mcp', name: 'Plain', auth: 'none' })), /https/)
  assert.match(JSON.stringify(await call('connector-add', { url: 'https://x.example.com/mcp', name: 'X', auth: 'none', icon: 'javascript:alert(1)' })), /too large/)
})

test('a service with its own token header gets the bare token there', async (t) => {
  const { mounts, call } = await setup(t, [], [{ id: 'meet', name: 'Meet', url: MCP, auth: 'token', tokenHeader: 'X-Meet-Token' }])
  await call('connector-token', { id: 'meet', token: 'meet-token' })
  assert.deepEqual(mounts.at(-1).config.headers, { 'X-Meet-Token': 'meet-token' })
})
