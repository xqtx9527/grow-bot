import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'

const { outputFiles } = await build({
  stdin: { contents: "export { EmbeddedSettings } from './src/client/settings.js'", resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
  bundle: true, format: 'cjs', platform: 'browser', write: false, logLevel: 'silent',
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
})
const react = {
  Component: class Component {},
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  createContext: value => ({ Provider: () => null, value }), Fragment: Symbol('Fragment'),
  useSyncExternalStore: (_subscribe, get) => get(), useMemo: fn => fn(),
  useEffect() {}, useLayoutEffect() {}, useCallback: fn => fn, useRef: value => ({ current: value }),
  useState: value => [typeof value === 'function' ? value() : value, () => {}],
}
const module = { exports: {} }
runInNewContext(outputFiles[0].text, { module, exports: module.exports, require: name => name === 'react' ? react : name === 'react-dom' ? { createPortal: node => node } : {} })
const { EmbeddedSettings } = module.exports

test('account and model sections mount inside the current settings view', () => {
  for (const section of ['account', 'models']) {
    const entry = { options: { id: section }, component: () => null, inject: () => ({}) }
    const actions = { settingsSlots: { subscribe: () => () => {}, getVersion: () => 1, entries: () => [entry] } }
    const node = EmbeddedSettings({ section, actions, close: () => {} })
    assert.equal(node.props.entry, entry)
    assert.equal(typeof node.type, 'function')
  }
})

test('a signed-out account offers the sign-in action in place', () => {
  let called = false
  const actions = { settingsSlots: { subscribe: () => () => {}, getVersion: () => 1, entries: () => [] }, canSignIn: () => true, signIn: () => { called = true } }
  const node = EmbeddedSettings({ section: 'account', actions, close: () => {} })
  assert.equal(node.type, 'button')
  node.props.onClick()
  assert.equal(called, true)
})

test('the account component receives its registered locale and account hooks', () => {
  const source = { subscribe: () => () => {}, getSnapshot: () => ({ status: 'ready' }) }
  const entry = { options: { id: 'account' }, locale: 'settings.account', component: () => null, inject: () => ({ hooks: { account: source, theme: source } }) }
  const actions = { settingsSlots: { subscribe: () => () => {}, getVersion: () => 1, entries: () => [entry] }, settingsLocale: namespace => key => `${namespace}:${key}` }
  const wrapper = EmbeddedSettings({ section: 'account', actions, close: () => {} })
  const component = wrapper.type(wrapper.props)
  assert.equal(component.props.t('nav'), 'settings.account:nav')
  assert.equal(component.props.useAccount(value => value.status), 'ready')
  assert.equal(component.props.useTheme(value => value.status), 'ready')
})
