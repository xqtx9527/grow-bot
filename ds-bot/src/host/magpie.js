// Magpie: a local model gateway that serves subscriptions, API keys and local models behind
// one OpenAI-compatible endpoint. Its sign-ins and protocol conversion stay in Magpie; this
// module only reads its model directory and keeps one DSH route named `magpie` pointing at
// it. A local gateway checks no key, so the route holds the placeholder Magpie documents.
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'

const PI_AI = 'llm-pi-ai'
const ROUTE = 'magpie'
const DEFAULT_ENDPOINT = 'http://127.0.0.1:3425/v1'
const KEY_REF = 'MAGPIE_API_KEY'
const LOCAL_KEY = 'magpie'
const SYNC_MS = 5 * 60_000
const PROBE_TIMEOUT_MS = 2500
const MAX_MODELS = 500
// The thinking levels pi-ai accepts in a route's models list.
const THINKING = new Set(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'])
const INPUT_MODALITIES = new Set(['text', 'image'])

const invalid = message => Object.assign(new Error(message), { code: 'bot/invalid' })

// A Magpie address as the /v1 root a DSH route needs: the scheme and host as typed, the
// path kept, then `/v1` appended once. Anything that is not an http(s) URL is refused.
export function normalizeEndpoint(value) {
  const text = typeof value === 'string' ? value.trim() : ''
  let url
  try { url = new URL(text) } catch { throw invalid('Enter the Magpie address as an http address, like http://127.0.0.1:3425') }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw invalid('Enter the Magpie address as an http address, like http://127.0.0.1:3425')
  let path = url.pathname.replace(/\/+$/, '')
  if (!path.endsWith('/v1')) path = path === '' ? '/v1' : `${path}/v1`
  url.pathname = path
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

// The gateway root (the address whose `/v1/models` a route names) without its `/v1`.
const rootOf = endpoint => endpoint.replace(/\/v1$/, '')

function toModel(raw) {
  if (raw === null || typeof raw !== 'object') return undefined
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  if (id === '') return undefined
  const name = [raw.display_name, raw.name, raw.magpie_label].find(text => typeof text === 'string' && text.trim() !== '') ?? id
  const provider = typeof raw.owned_by === 'string' && raw.owned_by !== '' ? raw.owned_by : undefined
  const whole = value => (Number.isInteger(value) && value > 0 ? value : undefined)
  const contextWindow = whole(raw.context_window) ?? whole(raw.context_length) ?? whole(raw.max_input_tokens)
  const maxTokens = whole(raw.max_output_tokens) ?? whole(raw.max_tokens)
  const inputModalities = Array.isArray(raw.modalities?.input) ? raw.modalities.input.filter(kind => INPUT_MODALITIES.has(kind)) : undefined
  const levels = Array.isArray(raw.supported_reasoning_levels)
    ? [...new Set(raw.supported_reasoning_levels.map(entry => (typeof entry === 'string' ? entry : entry?.effort)).filter(level => THINKING.has(level)))]
    : []
  return {
    id,
    name,
    ...(provider === undefined ? {} : { provider }),
    ...(contextWindow === undefined ? {} : { contextWindow }),
    ...(maxTokens === undefined ? {} : { maxTokens }),
    ...(inputModalities === undefined || inputModalities.length === 0 ? {} : { inputModalities }),
    ...(raw.reasoning === false ? { reasoning: false } : {}),
    ...(levels.length === 0 ? {} : { reasoningEfforts: Object.fromEntries(levels.map(level => [level, level])) }),
  }
}

// The models a `/v1/models` reply lists, as the standard `data` array or the enriched
// `models` map pi-ai also accepts. Entries without an id are dropped.
export function modelsOf(reply) {
  if (Array.isArray(reply?.data)) return reply.data.map(toModel).filter(Boolean).slice(0, MAX_MODELS)
  if (reply?.models !== null && typeof reply.models === 'object') {
    return Object.entries(reply.models).map(([key, entry]) => (entry !== null && typeof entry === 'object' ? toModel({ id: key, ...entry }) : undefined)).filter(Boolean).slice(0, MAX_MODELS)
  }
  return []
}

// The providers the gateway reports, merged with the owners its model list names, each
// with how many models it currently serves. What `/v1/magpie/quotas` publishes is the
// account state (kind, plan); the model owners add any route that lists no quota.
export function providersOf(quotas, models) {
  const providers = new Map()
  const add = (id, name, kind, plan) => {
    if (typeof id !== 'string' || id === '') return
    const current = providers.get(id) ?? { id, name: id, kind: null, plan: null, modelCount: 0 }
    if (typeof name === 'string' && name !== '') current.name = name
    if (typeof kind === 'string' && kind !== '') current.kind = kind
    if (typeof plan === 'string' && plan !== '') current.plan = plan
    providers.set(id, current)
  }
  for (const row of Array.isArray(quotas?.data) ? quotas.data : []) add(row?.provider, row?.name, row?.kind, row?.plan)
  for (const model of models) if (model.provider !== undefined) add(model.provider)
  for (const model of models) {
    const provider = model.provider === undefined ? undefined : providers.get(model.provider)
    if (provider !== undefined) provider.modelCount += 1
  }
  return [...providers.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// The `llm-pi-ai` route value for the gateway's models. A model that states no name is
// listed under its id; unstated capacities stay absent so pi-ai's defaults apply.
export function profileFor(base, models) {
  return {
    displayName: 'Magpie',
    api: 'openai-completions',
    baseURL: base,
    apiKeyEnv: KEY_REF,
    models: models.map(model => ({
      id: model.id,
      ...(model.name && model.name !== model.id ? { name: model.name } : {}),
      ...(model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow }),
      ...(model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens }),
      ...(model.inputModalities === undefined ? {} : { input: model.inputModalities }),
      ...(model.reasoning === false ? { reasoningEfforts: false } : model.reasoningEfforts === undefined ? {} : { reasoningEfforts: model.reasoningEfforts }),
    })),
  }
}

export function install(rt) {
  const { ctx } = rt

  const settings = () => {
    const service = ctx.get?.('settings')
    if (!service?.describe || !service?.mutate) throw invalid('This DSH cannot set up model providers')
    return service
  }
  // The `llm-pi-ai` settings section: its revision for a write, and the routes it holds.
  const section = () => settings().describe({ redactSecrets: true }).find(entry => entry.ns === PI_AI)
  const profileOf = () => section()?.value?.providers?.[ROUTE]
  // Read-only status must not fail only because this DSH has no settings seam.
  const routeExists = () => { try { return profileOf() !== undefined } catch { return false } }

  const rawEndpoint = () => rt.state?.magpie?.endpoint ?? process.env.MAGPIE_URL ?? DEFAULT_ENDPOINT
  const endpoint = () => {
    try { return normalizeEndpoint(rawEndpoint()) } catch { return DEFAULT_ENDPOINT }
  }

  async function getJson(url) {
    let response
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS), headers: { accept: 'application/json' } })
    } catch (error) {
      throw Object.assign(new Error('The Magpie gateway did not answer'), { code: 'unreachable', cause: error })
    }
    if (response.status === 401 || response.status === 403) throw Object.assign(new Error('The Magpie gateway rejected the key'), { code: 'auth', status: response.status })
    if (!response.ok) throw Object.assign(new Error(`The Magpie gateway answered ${response.status}`), { code: 'http', status: response.status })
    try { return await response.json() } catch { throw Object.assign(new Error('The Magpie gateway did not return JSON'), { code: 'bad-json' }) }
  }

  // Everything the gateway publishes that this module needs: its manifest, its model
  // directory and its provider summary. The manifest answers first, so a gateway that is
  // not running fails as unreachable instead of as an empty catalog.
  async function inspect(base) {
    const manifest = await getJson(`${rootOf(base)}/`)
    let models = []
    let modelError
    try { models = modelsOf(await getJson(`${base}/models`)) } catch (error) { modelError = error }
    let providers = []
    try { providers = providersOf(await getJson(`${base}/magpie/quotas`), models) } catch { providers = providersOf(null, models) }
    return { manifest, models, modelError, providers }
  }

  function installed() {
    const home = process.env.HOME ?? ''
    return ['/Applications/Magpie.app', `${home}/Applications/Magpie.app`].some(path => { try { return existsSync(path) } catch { return false } })
  }

  // The status the service-providers page shows, without any credential.
  async function magpieStatus() {
    const base = endpoint()
    const local = installed()
    const status = {
      installed: local,
      reachable: false,
      endpoint: base,
      configured: routeExists(),
      owned: rt.state?.magpie?.created === true,
      version: null,
      pid: null,
      modelCount: 0,
      providers: [],
      lastCheckedAt: Date.now(),
      error: null,
      errorCode: null,
    }
    let found
    try { found = await inspect(base) } catch (error) {
      if (error?.code === 'auth') { status.error = 'The Magpie gateway rejected the key'; status.errorCode = 'auth' }
      else if (local) { status.error = 'Could not reach the Magpie gateway. Start Magpie first.'; status.errorCode = 'gateway-unreachable' }
      else { status.error = 'Magpie was not found on this computer'; status.errorCode = 'not-installed' }
      return status
    }
    status.installed = true
    status.reachable = true
    status.version = typeof found.manifest?.version === 'string' ? found.manifest.version : null
    status.pid = Number.isInteger(found.manifest?.pid) ? found.manifest.pid : null
    status.modelCount = found.models.length
    status.providers = found.providers
    if (found.modelError !== undefined) {
      status.error = 'The Magpie gateway did not list its models'
      status.errorCode = found.modelError?.code === 'auth' ? 'auth' : 'models-failed'
    } else if (found.models.length === 0) {
      status.error = 'Magpie has no models yet. Add a provider in Magpie first.'
      status.errorCode = 'no-models'
    }
    return status
  }

  // The model directory as a plain list a chooser can show, even while the gateway is
  // down (then reachable is false and the caller keeps its last list).
  async function magpieModels() {
    const base = endpoint()
    try {
      const found = await inspect(base)
      return { reachable: true, endpoint: base, models: found.models, providers: found.providers, fetchedAt: Date.now(), error: null }
    } catch (error) {
      return { reachable: false, endpoint: base, models: [], providers: [], fetchedAt: Date.now(), error: error?.code === 'auth' ? 'auth' : 'gateway-unreachable' }
    }
  }

  // One DSH route named `magpie` at the gateway's /v1 root, serving the models the
  // gateway lists. Only `providers.magpie` is written; other routes are untouched.
  async function writeRoute(base, models) {
    const service = settings()
    const current = section()
    if (current === undefined) throw invalid('This DSH cannot set up model providers')
    await ctx.get('credentials')?.set(KEY_REF, LOCAL_KEY)
    await service.mutate(PI_AI, [{ op: 'set', path: ['providers', ROUTE], value: profileFor(base, models) }], current.revision)
  }

  async function magpieConfigure(body = {}) {
    const base = normalizeEndpoint(body.endpoint ?? rawEndpoint())
    let found
    try { found = await inspect(base) } catch (error) {
      throw invalid(error?.code === 'auth' ? 'The Magpie gateway rejected the key' : 'Could not reach the Magpie gateway. Start Magpie first.')
    }
    if (found.models.length === 0) throw invalid('Magpie has no models yet. Add a provider in Magpie first.')
    await writeRoute(base, found.models)
    rt.state.magpie = { created: true, endpoint: base, configuredAt: Date.now(), lastSyncedAt: Date.now() }
    await rt.save()
    rt.dropCatalog?.()
    return magpieStatus()
  }

  // New models the gateway added since the route was written. A gateway that is down or
  // lists nothing keeps the last route and marks the status stale, never empties it.
  async function magpieRefresh() {
    if (!routeExists() && rt.state?.magpie?.created !== true) throw invalid('Magpie is not connected')
    const base = endpoint()
    const before = (profileOf()?.models ?? []).map(model => model.id).join('\n')
    let found
    try { found = await inspect(base) } catch { const status = await magpieStatus(); status.stale = true; return status }
    if (found.models.length === 0) { const status = await magpieStatus(); status.stale = true; return status }
    // A route found after a reset team file is adopted here rather than refused.
    const adopted = rt.state?.magpie?.created !== true
    if (found.models.map(model => model.id).join('\n') !== before || adopted) {
      await writeRoute(base, found.models)
      rt.state.magpie = { ...rt.state.magpie, created: true, endpoint: base, lastSyncedAt: Date.now() }
      await rt.save()
      rt.dropCatalog?.()
    }
    return magpieStatus()
  }

  // Only the route this module created goes; a route the user added some other way is
  // left alone. Removing the route is all it takes: the team's Bots keep their own saved
  // selection and fall back when the route is gone. A gateway that is down does not stop
  // the disconnect: the route exists in settings, not in the gateway.
  async function magpieDisconnect() {
    const service = settings()
    const current = section()
    if (current === undefined) throw invalid('This DSH cannot set up model providers')
    if (!routeExists() && rt.state?.magpie?.created !== true) throw invalid('Magpie is not connected')
    if (routeExists()) await service.mutate(PI_AI, [{ op: 'unset', path: ['providers', ROUTE] }], current.revision)
    await ctx.get('credentials')?.unset(KEY_REF)
    delete rt.state.magpie
    await rt.save()
    rt.dropCatalog?.()
    return magpieStatus()
  }

  // Bring the Magpie window forward so the user can sign a provider in themselves. The
  // module never starts a sign-in, reads a password or handles a verification code.
  function magpieOpen() {
    return new Promise(resolve => {
      if (process.platform !== 'darwin') return resolve({ opened: false })
      try {
        execFile('open', ['-a', 'Magpie'], error => resolve({ opened: !error }))
      } catch { resolve({ opened: false }) }
    })
  }

  // Models added in Magpie reach the Bots without a visit to the settings.
  ctx.effect?.(() => {
    const timer = setInterval(() => {
      if (rt.state?.magpie?.created === true) void magpieRefresh().catch(() => {})
    }, SYNC_MS)
    timer.unref?.()
    return () => clearInterval(timer)
  }, 'ds-bot: magpie sync')

  Object.assign(rt, { magpieStatus, magpieModels, magpieConfigure, magpieRefresh, magpieDisconnect, magpieOpen })
}
