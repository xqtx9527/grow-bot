// OAuth for MCP servers: OAuth 2.1 with PKCE, in a browser. A service with dynamic client
// registration takes Grow Bot as it is; one without it (Google) needs a client the user made.
// Only the protocol is here. Who keeps the tokens is oauth-connectors.js.
import { createHash, randomBytes } from 'node:crypto'

const TIMEOUT_MS = 15_000
const CLIENT_NAME = 'Grow Bot'

const base64url = buffer => buffer.toString('base64url')
export const randomState = () => base64url(randomBytes(32))
export function pkcePair() {
  const verifier = base64url(randomBytes(32))
  return { verifier, challenge: base64url(createHash('sha256').update(verifier).digest()) }
}

const timed = init => ({ ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })

async function jsonOf(url, request) {
  let response
  try { response = await request(url, timed({ headers: { Accept: 'application/json' } })) } catch { return undefined }
  if (!response.ok) return undefined
  return response.json().catch(() => undefined)
}

// Where the server's protected-resource metadata is: named in its 401, or at the well-known
// addresses, path first.
async function resourceMetadata(url, request) {
  const { origin, pathname } = new URL(url)
  const tried = [`${origin}/.well-known/oauth-protected-resource${pathname === '/' ? '' : pathname}`, `${origin}/.well-known/oauth-protected-resource`]
  try {
    const probe = await request(url, timed({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
    }))
    const named = probe.headers?.get?.('www-authenticate')?.match(/resource_metadata="([^"]+)"/)?.[1]
    if (named !== undefined) tried.unshift(named)
  } catch { /* the well-known addresses may still answer */ }
  for (const address of tried) {
    const found = await jsonOf(address, request)
    if (found?.authorization_servers?.[0] !== undefined) return found
  }
  return undefined
}

/**
 * How an address signs in: `oauth`, `oauth-client` when the user must bring a client, `token`
 * when it refuses without saying how, or `none` when it answers anyone.
 */
export async function inspectAuth(url, { fetch: request = fetch } = {}) {
  const server = await discover(url, { fetch: request }).catch(() => undefined)
  if (server !== undefined) return server.needsClient ? 'oauth-client' : 'oauth'
  let response
  try {
    response = await request(url, timed({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'Grow Bot', version: '1' } } }),
    }))
  } catch { throw new Error('Could not reach this address') }
  if (response.status === 401 || response.status === 403) return 'token'
  if (response.ok) return 'none'
  throw new Error(`This address answered ${response.status}, so it may not be an MCP server`)
}

/** The authorization server of an MCP server, read from its own metadata. */
export async function discover(url, { fetch: request = fetch } = {}) {
  const resource = await resourceMetadata(url, request)
  const issuer = new URL(resource?.authorization_servers?.[0] ?? new URL(url).origin)
  const path = issuer.pathname === '/' ? '' : issuer.pathname.replace(/\/$/, '')
  for (const address of [`${issuer.origin}/.well-known/oauth-authorization-server${path}`, `${issuer.origin}/.well-known/openid-configuration${path}`]) {
    const server = await jsonOf(address, request)
    if (typeof server?.authorization_endpoint !== 'string' || typeof server?.token_endpoint !== 'string') continue
    if (!/^https:/i.test(server.authorization_endpoint) || !/^https:/i.test(server.token_endpoint)) throw new Error('This service does not sign in over https')
    const google = issuer.hostname === 'accounts.google.com'
    return {
      ...server,
      // Google refuses a resource parameter, and gives a refresh token only when asked.
      resource: google ? undefined : resource?.resource ?? url,
      scopes: resource?.scopes_supported ?? server.scopes_supported,
      extra: google ? { access_type: 'offline', prompt: 'consent' } : {},
      needsClient: typeof server.registration_endpoint !== 'string',
    }
  }
  throw new Error('This service did not say how to sign in')
}

async function postJson(url, body, request) {
  let response
  try {
    response = await request(url, timed({ method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) }))
  } catch { throw new Error('Could not reach the service') }
  if (!response.ok) throw new Error(`The service answered ${response.status}`)
  return response.json()
}

/** Registers Grow Bot with the service for this one redirect address. */
export async function registerClient(server, redirectUri, { fetch: request = fetch } = {}) {
  const client = await postJson(server.registration_endpoint, {
    client_name: CLIENT_NAME,
    redirect_uris: [redirectUri],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  }, request)
  if (typeof client?.client_id !== 'string') throw new Error('The service did not register Grow Bot')
  return { clientId: client.client_id, ...(typeof client.client_secret === 'string' ? { clientSecret: client.client_secret } : {}) }
}

/** The address where the user signs in. */
export function authorizationUrl(server, { clientId, redirectUri, state, challenge }) {
  const url = new URL(server.authorization_endpoint)
  const scope = Array.isArray(server.scopes) ? server.scopes.join(' ') : ''
  for (const [key, value] of Object.entries({
    response_type: 'code', client_id: clientId, redirect_uri: redirectUri, state,
    code_challenge: challenge, code_challenge_method: 'S256',
    ...(server.resource === undefined ? {} : { resource: server.resource }),
    ...(scope === '' ? {} : { scope }),
    ...server.extra,
  })) url.searchParams.set(key, value)
  return url.toString()
}

async function tokenRequest(endpoint, fields, request) {
  const body = new URLSearchParams(Object.entries(fields).filter(([, value]) => value !== undefined))
  let response
  try {
    response = await request(endpoint, timed({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body }))
  } catch { throw new Error('Could not reach the service') }
  if (response.status === 400 || response.status === 401) throw Object.assign(new Error('The service refused the sign-in'), { code: 'refused' })
  if (!response.ok) throw new Error(`The service answered ${response.status}`)
  const tokens = await response.json().catch(() => undefined)
  if (typeof tokens?.access_token !== 'string' || tokens.access_token === '') throw new Error('The service sent no token')
  return {
    accessToken: tokens.access_token,
    ...(typeof tokens.refresh_token === 'string' && tokens.refresh_token !== '' ? { refreshToken: tokens.refresh_token } : {}),
    ...(Number.isFinite(tokens.expires_in) ? { expiresAt: Date.now() + tokens.expires_in * 1000 } : {}),
  }
}

const clientFields = client => ({ client_id: client.clientId, ...(client.clientSecret === undefined ? {} : { client_secret: client.clientSecret }) })

export const exchangeCode = (endpoint, client, { code, redirectUri, verifier, resource }, { fetch: request = fetch } = {}) => tokenRequest(endpoint, {
  grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier, resource, ...clientFields(client),
}, request)

export const refreshTokens = (endpoint, client, { refreshToken, resource }, { fetch: request = fetch } = {}) => tokenRequest(endpoint, {
  grant_type: 'refresh_token', refresh_token: refreshToken, resource, ...clientFields(client),
}, request)
