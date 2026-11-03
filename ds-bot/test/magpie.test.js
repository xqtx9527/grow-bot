// The Magpie gateway integration, against a fake HTTP gateway on a free port and fake DSH
// settings. No real account, key or user data is touched.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { install, modelsOf, normalizeEndpoint, providersOf } from '../src/host/magpie.js'

const MODELS = [
  {
    id: 'group/exec-a',
    display_name: '执行',
    owned_by: 'workbuddy-ai',
    context_window: 1000000,
    max_output_tokens: 128000,
    modalities: { input: ['text', 'image'] },
    supported_reasoning_levels: [{ effort: 'low' }, { effort: 'high' }],
    reasoning: true,
  },
  {
    id: 'token-sensenova/kimi-k3',
    display_name: 'Kimi K3',
    owned_by: 'token-sensenova',
    max_input_tokens: 1048576,
    max_tokens: 131072,
    modalities: { input: ['text'] },
    supported_reasoning_levels: [],
    reasoning: false,
  },
]

const QUOTAS = [{ provider: 'workbuddy-ai', name: 'WorkBuddy AI', kind: 'subscription', plan: 'Free plan' }]

// A fake DSH `llm-pi-ai` settings section that takes path writes under a revision.
function harness({ user = {}, base = {} } = {}) {
  const writes = []
  let dropped = 0
  let revision = 0
  let pi = { user: structuredClone(user), base: structuredClone(base) }
  const value = () => ({ providers: { ...pi.base.providers, ...pi.user.providers } })
  const settings = {
    describe: () => [{ ns: 'llm-pi-ai', revision, value: value(), user: structuredClone(pi.user), base: structuredClone(pi.base) }],
    mutate: async (ns, ops, expected) => {
      if (expected !== revision) throw new Error('settings namespace changed since it was read')
      const next = structuredClone(pi.user)
      for (const op of ops) {
        const parent = op.path.slice(0, -1).reduce((table, key) => (table[key] ??= {}), next)
        if (op.op === 'set') parent[op.path.at(-1)] = op.value
        else delete parent[op.path.at(-1)]
      }
      writes.push([ns, ops])
      pi = { ...pi, user: next }
      revision += 1
    },
  }
  const stored = new Map()
  const credentials = { set: async (ref, value) => { stored.set(ref, value) }, unset: async (ref) => { stored.delete(ref) } }
  const rt = { ctx: { get: name => (name === 'settings' ? settings : name === 'credentials' ? credentials : undefined) }, state: {}, save: async () => {}, dropCatalog: () => { dropped += 1 } }
  install(rt)
  return { rt, writes, value, stored, pi: () => pi, dropped: () => dropped }
}

// A fake Magpie gateway. `models` may be a function so a test can change the directory.
async function gateway({ models = MODELS, quotas = QUOTAS, status = 200, auth = false } = {}) {
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://gateway')
    const send = (code, body) => { response.writeHead(code, { 'content-type': 'application/json' }); response.end(JSON.stringify(body)) }
    if (url.pathname === '/') return send(200, { name: 'magpie', version: '0.1.2150', pid: 4242 })
    if (auth) return send(401, { error: { message: 'unauthorized' } })
    if (url.pathname === '/v1/models') return send(status, status === 200 ? { data: typeof models === 'function' ? models() : models } : { error: { message: 'boom' } })
    if (url.pathname === '/v1/magpie/quotas') return send(200, { data: quotas })
    send(404, {})
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const endpoint = `http://127.0.0.1:${server.address().port}/v1`
  return { endpoint, close: () => new Promise(resolve => server.close(resolve)) }
}

test('an endpoint becomes the /v1 root a route needs', () => {
  assert.equal(normalizeEndpoint('http://127.0.0.1:3425'), 'http://127.0.0.1:3425/v1')
  assert.equal(normalizeEndpoint(' http://127.0.0.1:3425/ '), 'http://127.0.0.1:3425/v1')
  assert.equal(normalizeEndpoint('http://127.0.0.1:3425/v1/'), 'http://127.0.0.1:3425/v1')
  assert.equal(normalizeEndpoint('https://gw.example/base'), 'https://gw.example/base/v1')
  assert.throws(() => normalizeEndpoint(''), /http address/)
  assert.throws(() => normalizeEndpoint('ftp://127.0.0.1'), /http address/)
})

test('the model directory keeps nested ids and the capabilities it states', () => {
  const models = modelsOf({ data: MODELS })
  assert.deepEqual(models.map(model => model.id), ['group/exec-a', 'token-sensenova/kimi-k3'])
  assert.equal(models[0].provider, 'workbuddy-ai')
  assert.equal(models[0].contextWindow, 1000000)
  assert.equal(models[0].maxTokens, 128000)
  assert.deepEqual(models[0].inputModalities, ['text', 'image'])
  assert.deepEqual(models[0].reasoningEfforts, { low: 'low', high: 'high' })
  assert.equal(models[1].contextWindow, 1048576)
  assert.equal(models[1].reasoning, false)
  // Entries without an id are dropped; the enriched `models` map is accepted too.
  assert.deepEqual(modelsOf({ data: [{ name: 'no id' }] }), [])
  assert.deepEqual(modelsOf({ models: { 'a/b': { display_name: 'AB' } } }).map(model => [model.id, model.name]), [['a/b', 'AB']])
})

test('providers merge the quota summary with the owners the models name', () => {
  const providers = providersOf({ data: QUOTAS }, modelsOf({ data: MODELS }))
  const byId = Object.fromEntries(providers.map(provider => [provider.id, provider]))
  assert.equal(byId['workbuddy-ai'].name, 'WorkBuddy AI')
  assert.equal(byId['workbuddy-ai'].plan, 'Free plan')
  assert.equal(byId['workbuddy-ai'].modelCount, 1)
  assert.equal(byId['token-sensenova'].modelCount, 1)
})

test('status reports a reachable gateway without any credential', async () => {
  const gatewayServer = await gateway()
  const { rt } = harness()
  rt.state.magpie = { endpoint: gatewayServer.endpoint }
  const status = await rt.magpieStatus()
  await gatewayServer.close()
  assert.equal(status.reachable, true)
  assert.equal(status.configured, false)
  assert.equal(status.version, '0.1.2150')
  assert.equal(status.pid, 4242)
  assert.equal(status.modelCount, 2)
  assert.equal(status.error, null)
  assert.equal(JSON.stringify(status).toLowerCase().includes('authorization'), false)
})

test('connect writes only the magpie route from the current directory', async () => {
  const gatewayServer = await gateway()
  const { rt, writes, value } = harness({ user: { providers: { deepseek: { apiKeyEnv: 'DEEPSEEK_API_KEY' } } } })
  const status = await rt.magpieConfigure({ endpoint: gatewayServer.endpoint })
  await gatewayServer.close()
  assert.equal(status.configured, true)
  assert.equal(status.owned, true)
  assert.equal(status.modelCount, 2)
  const [, ops] = writes.at(-1)
  assert.deepEqual(ops.map(op => op.path), [['providers', 'magpie']])
  const profile = value().providers.magpie
  assert.equal(profile.api, 'openai-completions')
  assert.equal(profile.baseURL, gatewayServer.endpoint)
  assert.deepEqual(profile.models.map(model => model.id), ['group/exec-a', 'token-sensenova/kimi-k3'])
  assert.deepEqual(value().providers.deepseek, { apiKeyEnv: 'DEEPSEEK_API_KEY' })
  assert.equal(rt.state.magpie.created, true)
})

test('connect refuses a gateway with no models', async () => {
  const gatewayServer = await gateway({ models: [] })
  const { rt, writes } = harness()
  await assert.rejects(rt.magpieConfigure({ endpoint: gatewayServer.endpoint }), /no models yet/)
  await gatewayServer.close()
  assert.equal(writes.length, 0)
})

test('connect refuses a gateway that is not running', async () => {
  const gatewayServer = await gateway()
  const { endpoint } = gatewayServer
  await gatewayServer.close()
  const { rt } = harness()
  await assert.rejects(rt.magpieConfigure({ endpoint }), /Could not reach the Magpie gateway/)
})

test('status tells a down gateway apart from a reachable one', async () => {
  const gatewayServer = await gateway()
  const endpoint = gatewayServer.endpoint
  await gatewayServer.close()
  const { rt } = harness()
  rt.state.magpie = { created: true, endpoint }
  const status = await rt.magpieStatus()
  assert.equal(status.reachable, false)
  assert.ok(['gateway-unreachable', 'not-installed'].includes(status.errorCode))
})

test('refresh follows a changed directory and keeps the route when the gateway is down', async () => {
  let models = MODELS
  const gatewayServer = await gateway({ models: () => models })
  const { rt, value } = harness()
  await rt.magpieConfigure({ endpoint: gatewayServer.endpoint })
  models = [...MODELS, { id: 'workbuddy/extra', display_name: 'Extra', owned_by: 'workbuddy', reasoning: false }]
  await rt.magpieRefresh()
  assert.deepEqual(value().providers.magpie.models.map(model => model.id), ['group/exec-a', 'token-sensenova/kimi-k3', 'workbuddy/extra'])
  await gatewayServer.close()
  const status = await rt.magpieRefresh()
  assert.equal(status.stale, true)
  // The last route survives a gateway that is down.
  assert.equal(value().providers.magpie.models.length, 3)
})

test('disconnect removes only the route this plugin created', async () => {
  const gatewayServer = await gateway()
  const { rt, value } = harness({ user: { providers: { deepseek: { apiKeyEnv: 'DEEPSEEK_API_KEY' }, moonshotai: { apiKeyEnv: 'MOONSHOTAI_API_KEY' } } } })
  await rt.magpieConfigure({ endpoint: gatewayServer.endpoint })
  await gatewayServer.close()
  const status = await rt.magpieDisconnect()
  assert.equal(status.configured, false)
  assert.equal(rt.state.magpie, undefined)
  assert.equal(value().providers.magpie, undefined)
  assert.deepEqual(value().providers.deepseek, { apiKeyEnv: 'DEEPSEEK_API_KEY' })
  assert.deepEqual(value().providers.moonshotai, { apiKeyEnv: 'MOONSHOTAI_API_KEY' })
  await assert.rejects(rt.magpieDisconnect(), /not connected/)
})

test('a route written by this plugin is found again after a restart', async () => {
  const gatewayServer = await gateway()
  const first = harness()
  await first.rt.magpieConfigure({ endpoint: gatewayServer.endpoint })
  await gatewayServer.close()
  const saved = first.pi().user
  const second = harness({ user: saved })
  const status = await second.rt.magpieStatus()
  assert.equal(status.configured, true)
  assert.equal(status.owned, false)
  // A team file that no longer records the connect still removes the route it finds.
  const after = await second.rt.magpieDisconnect()
  assert.equal(after.configured, false)
  assert.equal(second.value().providers.magpie, undefined)
})

test('an unreachable gateway still yields a model list a chooser can keep', async () => {
  const gatewayServer = await gateway()
  const endpoint = gatewayServer.endpoint
  await gatewayServer.close()
  const { rt } = harness()
  rt.state.magpie = { created: true, endpoint }
  const catalog = await rt.magpieModels()
  assert.equal(catalog.reachable, false)
  assert.deepEqual(catalog.models, [])
  assert.equal(catalog.error, 'gateway-unreachable')
})
