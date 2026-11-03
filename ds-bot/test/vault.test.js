import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { apply } from '../index.js'
import { parseCsv, parseLogins, siteMatches, siteOf } from '../src/host/vault.js'
import { isSealed, seal, unseal } from '../src/host/vault-crypto.js'
import { toolDefs } from '../src/host/browser/refs.js'
import { fakeContext } from './fake-ctx.js'

const TEAM = { version: 1, mainBotIds: ['m1'], revision: 1, bots: { m1: { id: 'm1', sessionId: 'm1', name: 'Chief', role: '', instructions: '', createdAt: 1 } }, rooms: {}, exchanges: [], exchangeTurns: {}, questions: {} }

async function setup(t, { key = randomBytes(32), secrets, home = mkdtempSync(join(tmpdir(), 'dsb-vault-')) } = {}) {
  t.after(() => rmSync(home, { recursive: true, force: true }))
  writeFileSync(join(home, 'state.json'), JSON.stringify(TEAM))
  if (secrets) writeFileSync(join(home, 'secrets.json'), JSON.stringify(secrets))
  const ctx = fakeContext()
  const register = ctx.connection.fetch.register
  ctx.connection.fetch.register = (route) => { ctx.route = route; return register(route) }
  apply(ctx, { home, github: false, connectors: false, vaultKey: key })
  const call = async (endpoint, payload) => (await ctx.route.fetch(new Request('http://localhost/api/bot', { method: 'POST', body: JSON.stringify({ endpoint, payload }) }))).json()
  await call('state', {})
  return { home, call, key }
}

test('a sealed record opens only with its key, and notices a change', () => {
  const key = randomBytes(32)
  const record = seal(key, 'hello')
  assert.ok(isSealed(record))
  assert.equal(unseal(key, record), 'hello')
  assert.throws(() => unseal(randomBytes(32), record))
  assert.throws(() => unseal(key, { ...record, data: Buffer.from('other').toString('base64') }))
})

test('a site is its host, and a login fits it and its subdomains only', () => {
  assert.equal(siteOf('https://www.Example.com/login?x=1'), 'example.com')
  assert.equal(siteOf('accounts.google.com'), 'accounts.google.com')
  assert.throws(() => siteOf('nonsense'), /Enter the site/)
  assert.ok(siteMatches('example.com', 'example.com'))
  assert.ok(siteMatches('example.com', 'login.example.com'))
  assert.equal(siteMatches('example.com', 'example.com.evil.test'), false)
  assert.equal(siteMatches('example.com', 'notexample.com'), false)
})

test('a saved login is sealed on disk and its password never reaches the window', async (t) => {
  const { home, call } = await setup(t)
  const saved = await call('vault-save', { kind: 'login', site: 'accounts.example.com', username: 'me@example.com', password: 'hunter2-long-password' })
  assert.equal(saved.ok, true, JSON.stringify(saved))
  assert.equal(JSON.stringify(saved).includes('hunter2'), false)
  assert.deepEqual([saved.value.items[0].site, saved.value.items[0].hasPassword], ['accounts.example.com', true])
  const file = readFileSync(join(home, 'vault.json'), 'utf8')
  assert.equal(file.includes('hunter2') || file.includes('me@example.com'), false)
  assert.ok(isSealed(JSON.parse(file)))
  assert.equal(JSON.stringify((await call('state', {})).value.vault).includes('hunter2'), false)
})

test('an old secrets file is sealed, and keeps its values', async (t) => {
  const { home, key, call } = await setup(t, { secrets: { version: 1, secrets: [{ name: 'MY_KEY', value: 'plain-value-here', scope: 'all' }] } })
  await call('state', {})
  await new Promise(resolve => setTimeout(resolve, 60))
  const record = JSON.parse(readFileSync(join(home, 'secrets.json'), 'utf8'))
  assert.ok(isSealed(record))
  assert.match(unseal(key, record), /plain-value-here/)
})

test('sign-in types the saved login and hands the model no password', async () => {
  const typed = []
  const tool = toolDefs.find(entry => entry.name === 'browser_sign_in')
  const ctx = {
    session: { url: () => 'https://accounts.example.com/login', type: async (ref, text, submit) => { typed.push([ref, text, submit]); return { text: 'snapshot' } } },
    vault: { login: async () => ({ username: 'me', password: 'secret-pass' }) },
  }
  const result = await tool.execute({ username_ref: 'e1', password_ref: 'e2', submit: true }, ctx)
  assert.deepEqual(typed, [['e1', 'me', false], ['e2', 'secret-pass', true]])
  assert.equal(JSON.stringify(result).includes('secret-pass'), false)
  assert.match((await tool.execute({ password_ref: 'e2' }, { ...ctx, vault: { login: async () => undefined } })).text, /no login for this site/)
})

test('a login may cover several sites and go without an account name', async (t) => {
  const { call } = await setup(t)
  const saved = await call('vault-save', { kind: 'login', sites: ['https://a.example.com/x', 'b.example.org'], password: 'long-enough-password', hint: 'Work account' })
  assert.equal(saved.ok, true, JSON.stringify(saved))
  assert.deepEqual(saved.value.items[0].sites, ['a.example.com', 'b.example.org'])
  assert.equal(saved.value.items[0].hint, 'Work account')
})

test('a card is sealed, shows its last four digits, and only the window can reveal it', async (t) => {
  const { home, call } = await setup(t)
  assert.equal((await call('vault-save', { kind: 'card', number: '12', expiry: '12 / 30' })).ok, false)
  assert.equal((await call('vault-save', { kind: 'card', number: '4242 4242 4242 4242', expiry: '13 / 30' })).ok, false)
  const saved = await call('vault-save', { kind: 'card', number: '4242 4242 4242 4242', expiry: '12 / 30', securityCode: '737', nickname: 'Travel' })
  assert.equal(saved.value.items[0].last4, '4242')
  assert.equal(JSON.stringify(saved).includes('4242424242424242') || JSON.stringify(saved).includes('737'), false)
  assert.equal(readFileSync(join(home, 'vault.json'), 'utf8').includes('424242'), false)
  assert.deepEqual((await call('vault-reveal', { id: saved.value.items[0].id })).value, { number: '4242424242424242', securityCode: '737' })
})

test('a browser export imports, skipping broken rows and logins already saved', async (t) => {
  assert.deepEqual(parseCsv('a,"b,""c"""\r\n1,"2\n3"\n'), [['a', 'b,"c"'], ['1', '2\n3']])
  assert.throws(() => parseLogins('name,value\nx,y'), /no url and password/)
  const csv = 'name,url,username,password,note\nA,https://a.example.com/login,me,pass-word-one,Main\nBad,nonsense,me,x,\nEmpty,https://b.example.com,me,,\n'
  assert.equal(parseLogins(csv).skipped, 2)
  const { call } = await setup(t)
  const first = await call('vault-import', { csv })
  assert.deepEqual(first.value.imported, { added: 1, skipped: 2 })
  assert.equal(first.value.items[0].hint, 'Main')
  assert.equal((await call('vault-import', { csv })).value.imported.added, 0)
})

test('the saved logins tool lists accounts and hints, never a password', async () => {
  const tool = toolDefs.find(entry => entry.name === 'browser_saved_logins')
  const result = await tool.execute({}, { session: { url: () => 'https://a.example.com' }, vault: { logins: async () => [{ account: 'me', hint: 'Work' }] } })
  assert.equal(result.text, 'me — Work')
})

test('contact details saved by an older version leave the disk', async (t) => {
  const key = randomBytes(32)
  const first = await setup(t, { key })
  await first.call('vault-save', { kind: 'login', site: 'a.example.com', password: 'long-enough-password' })
  const path = join(first.home, 'vault.json')
  const open = JSON.parse(unseal(key, JSON.parse(readFileSync(path, 'utf8'))))
  open.items.push({ id: 'old', kind: 'contact', label: 'Me', email: 'old@example.com' })
  writeFileSync(path, JSON.stringify(seal(key, JSON.stringify(open))))
  const second = await setup(t, { key, home: first.home })
  const view = await second.call('vault-save', { kind: 'login', site: 'b.example.com', password: 'long-enough-password' })
  assert.deepEqual(view.value.items.map(item => item.kind), ['login', 'login'])
  assert.equal(unseal(key, JSON.parse(readFileSync(path, 'utf8'))).includes('old@example.com'), false)
  assert.equal((await second.call('vault-save', { kind: 'contact', email: 'x@example.com' })).ok, false)
})
