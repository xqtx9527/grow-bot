// The gateway's card on the Models page. Magpie does every sign-in and protocol translation;
// this card only shows its state and connects the one `magpie` route to it.
import { createElement as h, useEffect, useState } from 'react'
import { hostText, t } from './i18n.js'

const POLL_MS = 5000

export const magpieState = status => (!status.reachable ? (status.installed ? 'down' : 'missing') : status.configured ? 'connected' : 'ready')

export function MagpieCard({ actions }) {
  const [status, setStatus] = useState(null)
  const [endpoint, setEndpoint] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    let gone = false
    const read = () => actions.magpieStatus().then((value) => {
      if (gone) return
      setStatus(value)
      setEndpoint(current => (current === '' ? value.endpoint : current))
    }).catch(() => { if (!gone) setError(t('Could not load Magpie status.')) })
    void read()
    const timer = setInterval(read, POLL_MS)
    return () => { gone = true; clearInterval(timer) }
  }, [actions])
  if (status === null) return error ? h('div', { className: 'bt-set-hint', role: 'alert' }, error) : null
  const act = async (start) => {
    setBusy(true)
    setError('')
    setConfirm(false)
    try { setStatus(await start()) } catch (failure) { setError(hostText(failure?.message ?? String(failure))) } finally { setBusy(false) }
  }
  const button = (label, onClick, extra = '') => h('button', { type: 'button', className: `bt-soft bt-soft-sm ${extra}`.trim(), disabled: busy, onClick }, label)
  const state = magpieState(status)
  const label = {
    missing: t('Not detected'),
    down: t('Not running'),
    ready: t('Ready to connect · {count} models', { count: status.modelCount }),
    connected: t('Connected · {count} models', { count: status.modelCount }),
  }[state]
  const hint = status.error ? hostText(status.error)
    : state === 'connected' ? t('Pick a model in a Bot’s model selector. New models in Magpie arrive by themselves.')
      : t('Use your other AI subscriptions, API keys and local models through the Magpie gateway. Sign in to them in Magpie.')
  return h('div', { className: 'bt-magpie', 'data-state': state },
    h('div', { className: 'bt-magpie-head' },
      h('span', { className: 'bt-magpie-title' }, t('Magpie')),
      h('span', { className: 'bt-magpie-state' }, label)),
    h('div', { className: 'bt-set-hint' }, hint),
    state === 'missing' ? h('div', { className: 'bt-set-hint' }, t('Install Magpie from github.com/yetone/magpie, then retry.')) : null,
    status.configured ? null : h('label', { className: 'bt-magpie-endpoint' }, t('Gateway address'),
      h('input', { className: 'bt-input', value: endpoint, spellCheck: false, autoComplete: 'off', onChange: event => setEndpoint(event.target.value) })),
    h('div', { className: 'bt-magpie-actions' },
      status.installed ? button(t('Open Magpie'), () => { void actions.magpieOpen().catch(() => {}) }) : null,
      state !== 'connected' ? button(busy ? t('Connecting…') : t('Connect Magpie'), () => act(() => actions.magpieConfigure(endpoint.trim()))) : null,
      state === 'connected' ? button(t('Refresh models'), () => act(() => actions.magpieRefresh())) : null,
      status.configured && !confirm ? button(t('Disconnect'), () => setConfirm(true), 'bt-secret-danger') : null,
      confirm ? h('span', { className: 'bt-set-hint' }, t('Disconnect Magpie? Bots using its models need another model.')) : null,
      confirm ? button(t('Keep'), () => setConfirm(false)) : null,
      confirm ? button(t('Disconnect'), () => act(() => actions.magpieDisconnect()), 'bt-secret-danger') : null),
    error ? h('div', { className: 'bt-set-hint', role: 'alert', 'data-error': '' }, error) : null)
}

export const MAGPIE_CSS = `
.bt-magpie{display:flex;flex-direction:column;gap:10px;margin-bottom:18px;padding:16px 18px;border:1px solid var(--bt-line);border-radius:12px;background:var(--bt-main)}
.bt-magpie-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.bt-magpie-title{font-size:15px;font-weight:650;color:var(--bt-ink)}
.bt-magpie-state{font-size:12.5px;color:var(--bt-ink-3);white-space:nowrap}
.bt-magpie[data-state=connected] .bt-magpie-state{color:var(--bt-accent)}
.bt-magpie-endpoint{display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:var(--bt-ink-2)}
.bt-magpie-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.bt-magpie .bt-set-hint[data-error]{color:var(--bt-danger)}
`
