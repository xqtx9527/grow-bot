// Settings → Plugins: real DSH plugins, through DSH's own plugin manager. A plugin is code that
// runs on this computer, so Discover offers only reviewed packages, each pinned to the version
// that was reviewed. Keys and options stay on the plugin's own page in DSH.
import { createElement as h, useEffect, useState } from 'react'
import { PlugIcon } from './icons.js'
import { hostText, t } from './i18n.js'
import { Switch } from './bot-settings.js'
import { addedPlugins, REVIEWED_PLUGINS } from './library-catalog.js'
import { LibraryBar, LibraryCard, LibraryGrid, matches } from './library-page.js'

const failure = (result) => {
  if (!result.ok) return result.error?.message ?? String(result.error)
  const { application, error, packageResult } = result.value
  if (error) return error.message
  if (application === 'failed') return packageResult?.stderr || t('The plugin could not be changed.')
  return ''
}

export function PluginsPage({ actions }) {
  const manager = actions.pluginManager()
  const [bundles, setBundles] = useState(null)
  const [tab, setTab] = useState('mine')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [restart, setRestart] = useState(false)
  const refresh = async () => {
    const listed = await manager.listBundles()
    if (listed.ok) setBundles(addedPlugins(listed.value))
    else setError(hostText(listed.error?.message ?? ''))
  }
  useEffect(() => { if (manager) void refresh() }, [])
  const change = async (name, task) => {
    setBusy(name)
    setError('')
    try {
      const result = await task()
      const problem = failure(result)
      if (problem) setError(hostText(problem))
      else if (result.value.application === 'restart-required') setRestart(true)
      await refresh()
      return problem === ''
    } catch (thrown) {
      setError(hostText(thrown?.message ?? String(thrown)))
      return false
    } finally { setBusy('') }
  }
  const install = async (entry) => {
    if (await change(entry.name, () => manager.installBundle(entry.spec, { enabled: true, saveExact: true }))) setTab('mine')
  }
  if (!manager) return h('section', { className: 'bt-set-section' }, h('p', { className: 'bt-set-hint' }, t('Plugins need the desktop app.')))
  const has = name => bundles?.some(bundle => bundle.name === name)
  const reviewed = name => REVIEWED_PLUGINS.find(entry => entry.name === name)
  const titleOf = bundle => t(reviewed(bundle.name)?.title ?? bundle.name)
  const textOf = bundle => (reviewed(bundle.name) ? t(reviewed(bundle.name).description) : bundle.description ?? '')
  const shown = tab === 'mine'
    ? (bundles ?? []).filter(bundle => matches(query, titleOf(bundle), textOf(bundle))).map(bundle => h(LibraryCard, { key: bundle.name, mark: h(PlugIcon), title: titleOf(bundle), text: bundle.error?.message ?? [bundle.version && `v${bundle.version}`, textOf(bundle)].filter(Boolean).join(' · ') },
        h('button', { type: 'button', className: 'bt-soft bt-soft-sm', onClick: () => actions.pluginHome(bundle.name) }, t('Set up')),
        h(Switch, { on: bundle.enabled, label: titleOf(bundle), disabled: busy !== '', onChange: () => void change(bundle.name, () => manager.setBundleEnabled(bundle.name, !bundle.enabled)) }),
        h('button', { type: 'button', className: 'bt-soft bt-soft-sm bt-secret-danger', disabled: busy !== '', onClick: () => void change(bundle.name, () => manager.removeBundle(bundle.name)) }, t('Remove'))))
    : REVIEWED_PLUGINS.filter(entry => !has(entry.name) && matches(query, t(entry.title), t(entry.description))).map(entry => h(LibraryCard, { key: entry.name, mark: h(PlugIcon), title: t(entry.title), text: `${t(entry.description)} ${t(entry.warning)}` },
        h('button', { type: 'button', className: 'bt-soft bt-soft-sm', disabled: busy !== '', onClick: () => void install(entry) }, t(busy === entry.name ? 'Installing…' : 'Install'))))
  const reviewedNote = tab === 'mine' ? (bundles ?? []).map(bundle => reviewed(bundle.name)?.warning).find(Boolean) : undefined
  return h('section', { className: 'bt-set-section' },
    h(LibraryBar, { tab, onTab: setTab, query, onQuery: setQuery, onAdd: () => actions.pluginHome() }),
    h('p', { className: 'bt-set-hint' }, t('A plugin is code that runs on this computer. Add only plugins you trust.')),
    reviewedNote ? h('p', { className: 'bt-set-hint' }, t(reviewedNote)) : null,
    restart ? h('p', { className: 'bt-set-hint', role: 'status' }, t('Restart Grow Bot to apply this change.')) : null,
    error ? h('div', { className: 'bt-connector-error bt-connector-error-flush', role: 'alert' }, error) : null,
    bundles === null ? h('div', { className: 'bt-library-empty' }, t('Loading…'))
      : h(LibraryGrid, { empty: t(tab === 'mine' && query === '' ? 'No plugins yet. Add one from Discover.' : 'Nothing found') }, shown))
}
