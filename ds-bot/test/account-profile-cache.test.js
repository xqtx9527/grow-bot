import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'

// The footer bundled once and rendered with a stand-in React that keeps state and
// runs effects when their dependencies change, the way a commit would.
const { outputFiles } = await build({
  stdin: {
    contents: "export { AccountLauncher } from './src/client/sidebar.js'",
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
  },
  bundle: true, format: 'cjs', platform: 'browser', write: false, logLevel: 'silent',
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
})
const slots = []
let cursor = 0
let pending = []
const react = {
  createContext: (initial) => { const ctx = { value: initial }; ctx.Provider = ({ value, children }) => { ctx.value = value; return children }; return ctx },
  useContext: ctx => ctx.value,
  useCallback: fn => fn,
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), Fragment: Symbol('Fragment'),
  useState(initial) {
    const i = cursor++
    if (slots[i] === undefined) slots[i] = { v: typeof initial === 'function' ? initial() : initial }
    const slot = slots[i]
    return [slot.v, v => { slot.v = typeof v === 'function' ? v(slot.v) : v }]
  },
  useRef(initial) { const i = cursor++; if (slots[i] === undefined) slots[i] = { current: initial }; return slots[i] },
  useEffect(effect, deps) {
    const i = cursor++
    const before = slots[i]?.deps
    if (!before || deps.some((value, index) => !Object.is(value, before[index]))) pending.push(effect)
    slots[i] = { deps }
  },
  useMemo: make => make(), useLayoutEffect() {}, useSyncExternalStore: (subscribe, get) => get(), useId: () => 'id',
}
const stored = new Map()
const localStorage = {
  getItem: key => stored.get(key) ?? null,
  setItem: (key, value) => { stored.set(key, value) },
  removeItem: (key) => { stored.delete(key) },
}
const module = { exports: {} }
runInNewContext(outputFiles[0].text, {
  module, exports: module.exports, localStorage,
  window: { innerHeight: 800, addEventListener() {}, removeEventListener() {} },
  document: { body: {} }, setInterval: () => 0, clearInterval() {},
  require: name => (name === 'react' ? react : name === 'react-dom' ? { createPortal: node => node } : {}),
})
const { AccountLauncher } = module.exports

const KEY = 'bt-account-profile'
const find = (node, className) => {
  if (Array.isArray(node)) { for (const child of node) { const hit = find(child, className); if (hit) return hit } return null }
  if (!node || typeof node !== 'object') return null
  return node.props?.className?.split(' ').includes(className) ? node : find(node.props?.children, className)
}

// `snapshot` is the account plugin's value, and the entry can be absent or come later.
function footer({ snapshot = {}, withEntry = true } = {}) {
  slots.length = 0
  const state = { snapshot, withEntry, refreshes: 0 }
  const ops = {
    signOut: async () => {},
    refreshAccount: async () => { state.refreshes += 1 },
    hooks: { account: { subscribe: () => () => {}, getSnapshot: () => state.snapshot } },
  }
  const entry = { inject: () => ops }
  const props = { seat: false, profile: true, actions: { signInEntry: () => (state.withEntry ? entry : null), accountT: () => key => key, reportError() {} } }
  const render = () => {
    for (let round = 0; round < 3; round += 1) {
      cursor = 0
      pending = []
      const tree = AccountLauncher(props)
      const effects = pending
      pending = []
      effects.forEach(effect => effect())
      if (effects.length === 0) return tree
    }
    throw new Error('the footer did not settle')
  }
  return { state, render }
}
const shownName = tree => find(tree, 'bt-user-name').props.children.join('')
const shownAvatar = tree => find(tree, 'bt-user-pic').props.src
const remember = () => { stored.set(KEY, JSON.stringify({ name: 'Qin', avatar: 'https://example.test/a.png' })) }

for (const [label, options] of [
  ['the account entry has not arrived', { withEntry: false }],
  ['the account stream has no view yet', { snapshot: {} }],
]) {
  test(`while ${label}, the footer shows the cached profile and keeps it`, () => {
    remember()
    const tree = footer(options).render()
    assert.equal(shownName(tree), 'Qin')
    assert.equal(shownAvatar(tree), 'https://example.test/a.png')
    assert.ok(stored.has(KEY))
  })
}

test('a remembered avatar that no longer loads leaves the empty circle', () => {
  remember()
  const side = footer({ snapshot: {} })
  find(side.render(), 'bt-user-pic').props.onError()
  const tree = side.render()
  assert.equal(shownAvatar(tree), undefined)
  assert.ok(find(tree, 'bt-user-none'))
})

test('a view that says signed out drops the cached profile', () => {
  remember()
  const tree = footer({ snapshot: { view: { status: 'signed-out' } } }).render()
  assert.equal(shownName(tree), 'Account')
  assert.equal(stored.has(KEY), false)
})

test('a fresh profile replaces the cached one', () => {
  remember()
  const side = footer({ snapshot: {
    view: { status: 'credential-stored' },
    details: { profile: { status: 'ready', value: { name: 'New' } } },
    avatar: { status: 'ready', url: 'https://example.test/b.png' },
  } })
  assert.equal(shownName(side.render()), 'New')
  assert.deepEqual(JSON.parse(stored.get(KEY)), { name: 'New', avatar: 'https://example.test/b.png' })
})

const openMenu = (side, tree) => {
  const foot = find(tree, 'bt-user-foot')
  foot.props.ref.current = { getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0 }), contains: () => false, focus() {} }
  foot.props.onClick()
  side.render()
}

test('signed in with no profile yet, the footer reads it once at launch and again when its menu opens', () => {
  stored.clear()
  const side = footer({ snapshot: { view: { status: 'credential-stored' } } })
  const tree = side.render()
  assert.equal(side.state.refreshes, 1)
  openMenu(side, tree)
  assert.equal(side.state.refreshes, 2)
})

test('signed out, or before the account stream answers, the footer asks for no profile', () => {
  stored.clear()
  for (const snapshot of [{}, { view: { status: 'signed-out' } }]) {
    const side = footer({ snapshot })
    const tree = side.render()
    openMenu(side, tree)
    assert.equal(side.state.refreshes, 0)
  }
})

test('with the profile in hand the footer does not read it at launch', () => {
  stored.clear()
  const side = footer({ snapshot: { view: { status: 'credential-stored' }, details: { profile: { status: 'ready', value: { name: 'New' } } } } })
  side.render()
  assert.equal(side.state.refreshes, 0)
})
