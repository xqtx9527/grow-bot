import { createElement as h, useEffect, useRef, useState } from 'react'
import { CONNECTOR_LOGOS } from './connector-logos.js'
import { avatarImage } from './avatar-library.js'
import { useMorph } from './motion.js'
import { MaskedInput } from './secret-card.js'
import { PlusIcon } from './icons.js'
import { hostText, t } from './i18n.js'
import { blank, CapabilityCard, capabilityDraft, CapabilityForm } from './capability-settings.js'
import { LibraryBar, LibraryGrid, matches } from './library-page.js'

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'

export const GitHubMark = () => h('svg', { width: 24, height: 24, viewBox: '0 0 16 16', fill: 'currentColor', 'aria-hidden': true },
  h('path', { d: 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z' }))

const MARKS = { github: GitHubMark }
const ABOUT = {
  getnote: () => t('Search and save notes. GetNote membership required.'),
  'baidu-netdisk': () => t('Search and organize cloud files. Personal access is a trial.'),
  zsxq: () => t('Read and manage your communities. Sign in through your browser.'),
  github: () => t('Repositories, issues, and pull requests'),
  feishu: () => t('Docs, messages, and calendars'),
  'tencent-meeting': () => t('Meetings, recordings, and minutes'),
  gmail: () => t('Read, search, and draft email'),
  notion: () => t('Pages, databases, and notes'),
}

function statusText(connector) {
  if (connector.state === 'authorizing') return t('Waiting for you in the browser…')
  if (connector.state === 'connecting') return t('Connecting…')
  if (connector.state === 'error') return t('Could not connect: {error}', { error: hostText(connector.error ?? '') })
  if (connector.state === 'ready') return connector.account ? t('Connected as {account}', { account: connector.account }) : t('Connected')
  return ABOUT[connector.id]?.() ?? connector.host ?? ''
}

function ConnectorMark({ connector }) {
  const [broken, setBroken] = useState(false)
  const Mark = MARKS[connector.id]
  if (Mark) return h(Mark)
  const logo = CONNECTOR_LOGOS[connector.id]
  if (logo) return h('img', { className: 'bt-connector-logo', src: logo, alt: '' })
  if (connector.icon && !broken) return h('img', { className: 'bt-connector-icon', src: connector.icon, alt: '', onError: () => setBroken(true) })
  return (connector.name[0] ?? '?').toUpperCase()
}

function ConnectorRow({ connector, actions, autoStart, onStarted }) {
  const [form, setForm] = useState(false)
  const [token, setToken] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [signInUrl, setSignInUrl] = useState(null)
  const [userCode, setUserCode] = useState(null)
  const cancelled = useRef(false)
  const run = (task, after) => {
    setBusy(true)
    setError(null)
    return task.then(() => { after?.() }, failure => setError(hostText(failure?.message ?? String(failure)))).finally(() => setBusy(false))
  }
  // The window hands the page to the system browser, and the wait ends when it comes back.
  const authorize = (client) => {
    cancelled.current = false
    setError(null)
    setBusy(true)
    void actions.connectorAuthorize(connector.id, client).then(({ url, userCode: code }) => {
      setUserCode(code ?? null)
      setForm(false)
      setSignInUrl(url)
      window.open(url, '_blank', 'noopener')
      return actions.connectorWait(connector.id)
    }).catch((failure) => { if (!cancelled.current) setError(hostText(failure?.message ?? String(failure))) }).finally(() => { setSignInUrl(null); setBusy(false) })
  }
  const cancelSignIn = () => {
    cancelled.current = true
    void actions.connectorCancel(connector.id).catch(() => {})
  }
  const asksClient = connector.auth === 'oauth-client'
  const connect = () => {
    if (busy) return
    if (asksClient) { if (clientId.trim() !== '') authorize({ clientId, clientSecret }); return }
    if (token.trim() === '') return
    const task = connector.auth === 'token' ? actions.connectorToken(connector.id, token, clientId) : actions.connectorConnect(connector.id, token)
    void run(task, () => { setToken(''); setForm(false) })
  }
  const add = () => {
    if (connector.auth === 'netdisk-login') {
      if (!window.dsBotApp?.netdiskLogin) { setError(t('Open the desktop app to sign in')); return }
      void run(window.dsBotApp.netdiskLogin().then(value => value === null ? undefined : actions.connectorToken(connector.id, value)))
    }
    else if (['oauth', 'device'].includes(connector.auth)) authorize()
    else if (connector.auth === 'none') void run(actions.connectorOpen(connector.id))
    else setForm(true)
  }
  useEffect(() => {
    if (!autoStart) return
    onStarted()
    add()
  }, [autoStart])
  const cancelForm = () => { setForm(false); setToken(''); setClientId(''); setClientSecret(''); setError(null) }
  const on = connector.state !== 'off' && connector.state !== 'authorizing'
  const ready = asksClient ? clientId.trim() !== '' : token.trim() !== '' && (!connector.clientIdRequired || clientId.trim() !== '')
  const row = useRef(null)
  useMorph(row, `${form}:${error !== null}:${connector.state}`)
  return h('div', { ref: row, className: 'bt-connector', 'data-state': connector.state },
    h('div', { className: 'bt-connector-head' },
      h('span', { className: 'bt-connector-mark' }, h(ConnectorMark, { connector })),
      h('span', { className: 'bt-connector-text' },
        h('span', { className: 'bt-connector-name' }, t(connector.name)),
        h('span', { className: 'bt-connector-status' }, statusText(connector))),
      h('span', { className: 'bt-connector-actions' },
        connector.state === 'error' ? h('button', { type: 'button', className: 'bt-soft bt-soft-sm', disabled: busy, onClick: () => void run(actions.connectorRetry(connector.id)) }, t('Try again')) : null,
        on || connector.custom
          ? h('button', { type: 'button', className: 'bt-soft bt-soft-sm', disabled: busy, onClick: () => void run(actions.connectorDisconnect(connector.id)) }, connector.custom ? t('Remove') : t('Disconnect'))
          : null,
        !on && !form && signInUrl === null ? h('button', { type: 'button', className: 'bt-connector-add', 'aria-label': t('Connect {name}', { name: connector.name }), title: t('Connect'), disabled: busy, onClick: add }, h(PlusIcon)) : null)),
    signInUrl !== null ? h('div', { className: 'bt-connector-form-row bt-connector-signin' },
      userCode ? h('span', null, t('Confirm this code: {code}', { code: userCode })) : null,
      h('a', { className: 'bt-connector-link', href: signInUrl, target: '_blank', rel: 'noopener noreferrer' }, t('Open the sign-in page again')),
      h('button', { type: 'button', className: 'bt-soft bt-soft-sm', onClick: cancelSignIn }, t('Cancel'))) : null,
    !on && form ? h('div', { className: 'bt-connector-form' },
      connector.clientIdRequired ? h('label', { className: 'bt-connector-field' }, h('input', { className: 'bt-input', value: clientId, spellCheck: false, placeholder: t('Client ID'), 'aria-label': t('Client ID'), onChange: event => setClientId(event.target.value) })) : null,
      asksClient
        ? [
            h('label', { key: 'id', className: 'bt-connector-field' }, h('input', { className: 'bt-input', value: clientId, spellCheck: false, autoFocus: true, placeholder: t('Client ID'), 'aria-label': t('Client ID'), onChange: event => setClientId(event.target.value) })),
            h('label', { key: 'secret', className: 'bt-q-field bt-secret-field' }, h(MaskedInput, { value: clientSecret, onChange: setClientSecret, onEnter: connect, label: t('Client secret') })),
          ]
        : h('label', { className: 'bt-q-field bt-secret-field' }, h(MaskedInput, { value: token, onChange: setToken, onEnter: connect, label: connector.secretUrl ? t('Private MCP link') : connector.auth === 'token' ? t('Token') : t('GitHub token'), autoFocus: true })),
      h('div', { className: 'bt-connector-form-row' },
        connector.guide ? h('a', { className: 'bt-connector-link', href: connector.guide, target: '_blank', rel: 'noopener noreferrer' }, t('How to get these')) : null,
        connector.auth === undefined ? h('a', { className: 'bt-connector-link', href: TOKEN_URL, target: '_blank', rel: 'noopener noreferrer' }, t('Create a token on GitHub')) : null,
        h('span', { className: 'bt-connector-link' }),
        h('button', { type: 'button', className: 'bt-soft bt-soft-sm', disabled: busy, onClick: cancelForm }, t('Cancel')),
        h('button', { type: 'button', className: 'bt-soft bt-soft-sm', disabled: busy || !ready, onClick: connect }, busy ? t('Connecting…') : t('Connect'))),
      error ? h('div', { className: 'bt-connector-error', role: 'alert' }, error) : null) :
    error ? h('div', { className: 'bt-connector-error', role: 'alert' }, error) : null)
}

const AUTH_HINTS = {
  oauth: () => t('You sign in through your browser.'),
  'oauth-client': () => t('It needs a client ID, which you enter next.'),
  token: () => t('It needs a token, which you paste next.'),
  none: () => t('It needs no sign-in.'),
}

// A new connector from its address: Grow Bot works out how it signs in, its name and its icon.
function AddConnector({ actions, onAdded, onClose }) {
  const [url, setUrl] = useState('')
  const [found, setFound] = useState(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const file = useRef(null)
  const close = onClose
  const attempt = async (task) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try { await task() } catch (failure) { setError(hostText(failure?.message ?? String(failure))) } finally { setBusy(false) }
  }
  const inspect = () => attempt(async () => {
    const result = await actions.connectorInspect(url)
    setFound(result)
    setName(result.name)
    setIcon(result.icon)
  })
  const add = () => attempt(async () => {
    const added = await actions.connectorAdd({ url: found.url, name, auth: found.auth, ...(icon === undefined ? {} : { icon }) })
    close()
    onAdded(added.id)
  })
  const pick = event => attempt(async () => {
    const chosen = event.target.files?.[0]
    event.target.value = ''
    if (chosen) setIcon(await avatarImage(chosen))
  })
  return h('div', { className: 'bt-connector' },
    found === null
      ? h('label', { className: 'bt-connector-field' }, h('input', { className: 'bt-input', value: url, spellCheck: false, autoFocus: true, placeholder: 'https://mcp.example.com/mcp', 'aria-label': t('Address of the MCP server'), onChange: event => setUrl(event.target.value), onKeyDown: (event) => { if (event.key === 'Enter') void inspect() } }))
      : h('div', { className: 'bt-connector-head' },
          h('button', { type: 'button', className: 'bt-connector-mark bt-connector-pick', title: t('Choose an icon'), 'aria-label': t('Choose an icon'), onClick: () => file.current?.click() },
            icon ? h('img', { className: 'bt-connector-icon', src: icon, alt: '' }) : (name[0] ?? '?').toUpperCase()),
          h('input', { ref: file, type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', hidden: true, onChange: pick }),
          h('span', { className: 'bt-connector-text' },
            h('input', { className: 'bt-input', value: name, maxLength: 40, 'aria-label': t('Name'), onChange: event => setName(event.target.value) }),
            h('span', { className: 'bt-connector-status' }, AUTH_HINTS[found.auth]()))),
    error ? h('div', { className: 'bt-connector-error bt-connector-error-flush', role: 'alert' }, error) : null,
    h('div', { className: 'bt-connector-form-row' },
      h('span', { className: 'bt-connector-link' }),
      h('button', { type: 'button', className: 'bt-soft bt-soft-sm', disabled: busy, onClick: close }, t('Cancel')),
      found === null
        ? h('button', { type: 'button', className: 'bt-soft bt-soft-sm', disabled: busy || url.trim() === '', onClick: () => void inspect() }, busy ? t('Checking…') : t('Next'))
        : h('button', { type: 'button', className: 'bt-soft bt-soft-sm', disabled: busy || name.trim() === '', onClick: () => void add() }, t('Add'))))
}

// Settings → Connectors: what is connected, what can be, and MCP servers added by hand.
export function ConnectorsPage({ roster, actions, run }) {
  const list = roster?.connectors ?? []
  const servers = (roster?.capabilities ?? []).filter(item => item.kind === 'mcp').sort((a, b) => a.name.localeCompare(b.name))
  const connected = connector => connector.custom || !['off', 'authorizing'].includes(connector.state)
  const [tab, setTab] = useState(list.some(connected) || servers.length > 0 ? 'mine' : 'discover')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(null)
  const [starting, setStarting] = useState(null)
  const found = connector => matches(query, t(connector.name), connector.host, ABOUT[connector.id]?.())
  const rows = list.filter(connector => (tab === 'mine' ? connected(connector) : !connected(connector)) && found(connector))
    .map(connector => h(ConnectorRow, { key: connector.id, connector, actions, autoStart: starting === connector.id, onStarted: () => setStarting(null) }))
  const cards = tab === 'mine' ? servers.filter(item => matches(query, item.name, item.description)).map(item => h(CapabilityCard, { key: item.name, item, mark: item.name[0].toUpperCase(), actions, run, onEdit: () => setDraft(capabilityDraft(item)) })) : []
  return h('section', { className: 'bt-set-section' },
    h(LibraryBar, { tab, onTab: setTab, query, onQuery: setQuery, onAdd: () => setAdding(true) }),
    adding ? h('div', { className: 'bt-library-panel' },
      h(AddConnector, { actions, onClose: () => setAdding(false), onAdded: (id) => { setAdding(false); setTab('mine'); setStarting(id) } }),
      h('button', { type: 'button', className: 'bt-connector-link bt-connector-advanced', onClick: () => { setAdding(false); setDraft({ ...blank(), kind: 'mcp' }) } }, t('Add a local command or set headers by hand'))) : null,
    draft ? h('div', { className: 'bt-library-panel' }, h(CapabilityForm, { draft, setDraft, items: roster?.capabilities ?? [], actions, onClose: () => setDraft(null) })) : null,
    h(LibraryGrid, { empty: t(tab === 'mine' && query === '' ? 'Nothing connected yet. Add one from Discover.' : 'Nothing found') }, [...rows, ...cards]))
}
