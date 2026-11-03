import { createElement as h, useEffect, useState } from 'react'
import { hostText, t } from './i18n.js'
import { BrainIcon, PlusIcon } from './icons.js'
import { BUILT_IN_SKILLS } from './library-catalog.js'
import { LibraryBar, LibraryCard, LibraryGrid, matches } from './library-page.js'

export const blank = () => ({ name: '', kind: 'mcp', description: '', transport: 'stdio', command: '', argsText: '', envText: '{}', url: '', headersText: '{}', content: '', items: [] })
const parseMap = (text, label) => {
  let value
  try { value = JSON.parse(text || '{}') } catch { throw new Error(t('{label} must be valid JSON.', { label })) }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(t('{label} must be a JSON object.', { label }))
  return value
}
const statusText = status => !status ? undefined : status.state === 'ready' ? t('Ready')
  : status.state === 'needs-approval' ? t('Needs approval')
    : status.state === 'error' ? t('Could not connect: {error}', { error: status.error ?? '' })
      : t('Connecting…')

function Field({ label, value, onChange, multiline = false, disabled = false, placeholder }) {
  return h('label', { className: 'bt-set-row bt-bs-row bt-bs-stack' },
    h('span', { className: 'bt-set-copy' }, h('span', { className: 'bt-bs-label' }, t(label))),
    h(multiline ? 'textarea' : 'input', {
      className: multiline ? 'bt-input bt-input-area' : 'bt-input',
      value,
      disabled,
      maxLength: label === 'Name' ? 32 : undefined,
      placeholder,
      spellCheck: false,
      onChange: event => onChange(event.target.value),
    }))
}

export function CapabilityForm({ draft, setDraft, items, actions, onClose }) {
  const [error, setError] = useState('')
  const set = (key, value) => setDraft(previous => ({ ...previous, [key]: value }))
  const submit = async event => {
    event.preventDefault()
    setError('')
    let payload
    try {
      payload = { name: draft.name.trim(), kind: draft.kind, description: draft.description }
      if (draft.kind === 'mcp' && draft.transport === 'stdio') {
        payload.transport = 'stdio'
        payload.command = draft.command
        payload.args = draft.argsText.split('\n').filter(line => line !== '')
        payload.env = parseMap(draft.envText, t('Environment'))
      } else if (draft.kind === 'mcp') {
        payload.transport = 'streamable-http'
        payload.url = draft.url
        payload.headers = parseMap(draft.headersText, t('Headers'))
      } else if (draft.kind === 'skill') payload.content = draft.content
      else payload.items = draft.items
    } catch (failure) {
      setError(failure?.message ?? String(failure))
      return
    }
    try {
      await actions.saveCapability(payload)
      onClose()
    } catch (failure) {
      setError(failure?.message ?? String(failure))
    }
  }
  const available = items.filter(item => item.name !== draft.name && ['mcp', 'skill'].includes(item.kind))
  return h('form', { className: 'bt-connector-form', onSubmit: submit },
    h(Field, { label: 'Name', value: draft.name, disabled: draft.originalName !== undefined, onChange: value => set('name', value), placeholder: 'my-tool' }),
    h(Field, { label: 'Description', value: draft.description, onChange: value => set('description', value) }),
    draft.kind === 'mcp' ? h('label', { className: 'bt-set-row bt-bs-row bt-bs-stack' },
      h('span', { className: 'bt-set-copy' }, h('span', { className: 'bt-bs-label' }, t('Connection'))),
      h('select', { className: 'bt-input', value: draft.transport, onChange: event => set('transport', event.target.value) },
        h('option', { value: 'stdio' }, t('Local command')),
        h('option', { value: 'streamable-http' }, t('HTTP server')))) : null,
    draft.kind === 'mcp' && draft.transport === 'stdio' ? h('div', null,
      h(Field, { label: 'Command', value: draft.command, onChange: value => set('command', value) }),
      h(Field, { label: 'Arguments (one per line)', value: draft.argsText, onChange: value => set('argsText', value), multiline: true }),
      h(Field, { label: 'Environment (JSON)', value: draft.envText, onChange: value => set('envText', value), multiline: true, placeholder: t('{"API_KEY": "$DSH_SECRET_MY_KEY"}') })) : null,
    draft.kind === 'mcp' && draft.transport === 'streamable-http' ? h('div', null,
      h(Field, { label: 'URL', value: draft.url, onChange: value => set('url', value) }),
      h(Field, { label: 'Headers (JSON)', value: draft.headersText, onChange: value => set('headersText', value), multiline: true, placeholder: t('{"API_KEY": "$DSH_SECRET_MY_KEY"}') })) : null,
    draft.kind === 'skill' ? h(Field, { label: 'Skill instructions', value: draft.content, onChange: value => set('content', value), multiline: true }) : null,
    draft.kind === 'pack' ? h('div', { className: 'bt-set-card' },
      available.length === 0 ? h('div', { className: 'bt-set-row' }, h('span', { className: 'bt-set-hint' }, t('Save an MCP server or skill first.')))
        : available.map(item => h('label', { key: item.name, className: 'bt-set-row bt-bs-row' },
          h('span', { className: 'bt-set-copy' }, h('span', { className: 'bt-bs-label' }, item.name)),
          h('input', { type: 'checkbox', checked: draft.items.includes(item.name), onChange: event => set('items', event.target.checked ? [...draft.items, item.name] : draft.items.filter(name => name !== item.name)) })))) : null,
    error ? h('div', { className: 'bt-connector-error', role: 'alert' }, error) : null,
    h('div', { className: 'bt-connector-form-row' },
      h('button', { type: 'button', className: 'bt-soft bt-soft-sm', onClick: onClose }, t('Cancel')),
      h('button', { type: 'submit', className: 'bt-soft bt-soft-sm' }, draft.originalName ? t('Save changes') : t('Add'))))
}

export const capabilityDraft = item => ({
  ...blank(),
  ...item,
  originalName: item.name,
  argsText: (item.args ?? []).join('\n'),
  envText: JSON.stringify(item.env ?? {}, null, 2),
  headersText: JSON.stringify(item.headers ?? {}, null, 2),
  items: [...(item.items ?? [])],
})

// One saved item as a card, for all three kinds.
export function CapabilityCard({ item, mark, actions, run, onEdit }) {
  const [confirming, setConfirming] = useState(false)
  useEffect(() => {
    if (!confirming) return undefined
    const timer = setTimeout(() => setConfirming(false), 4000)
    return () => clearTimeout(timer)
  }, [confirming])
  const detail = item.kind === 'pack' ? (item.items ?? []).join(', ') || t('No items')
    : item.kind === 'mcp' ? (item.transport === 'stdio' ? t('Local command') : t('HTTP server')) : ''
  return h(LibraryCard, { mark, title: item.name, text: item.description || detail },
    item.kind === 'mcp' && item.transport === 'stdio' && !item.approved
      ? h('button', { type: 'button', className: 'bt-soft bt-soft-sm', onClick: () => void run(actions.approveCapability(item.name)) }, t('Allow')) : null,
    h('button', { type: 'button', className: 'bt-soft bt-soft-sm', onClick: onEdit }, t('Edit')),
    h('button', { type: 'button', className: 'bt-soft bt-soft-sm', onClick: () => { if (confirming) void run(actions.deleteCapability(item.name)); else setConfirming(true) } }, confirming ? t('Click again to delete.') : t('Delete')))
}

function DiscoverCard({ entry, mark, install, run }) {
  return h(LibraryCard, { mark, title: t(entry.title), text: t(entry.description) },
    h('button', { type: 'button', className: 'bt-connector-add', 'aria-label': t('Add {name}', { name: t(entry.title) }), title: t('Add'), onClick: () => void run(install(entry)) }, h(PlusIcon)))
}

// A skill from GitHub: nothing is saved until its text has been read here.
function SkillImport({ actions, onClose }) {
  const [url, setUrl] = useState('')
  const [found, setFound] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const attempt = async (task) => {
    setBusy(true)
    setError('')
    try { await task() } catch (failure) { setError(hostText(failure?.message ?? String(failure))) } finally { setBusy(false) }
  }
  const read = () => attempt(async () => setFound(await actions.importSkill(url)))
  const save = () => attempt(async () => {
    await actions.saveCapability({ name: found.name, kind: 'skill', description: found.description, content: found.content })
    onClose()
  })
  return h('div', { className: 'bt-connector-form' },
    found === null
      ? h('input', { className: 'bt-input', value: url, autoFocus: true, spellCheck: false, placeholder: 'https://github.com/owner/repo/tree/main/skill', 'aria-label': t('GitHub address'), onChange: event => setUrl(event.target.value) })
      : [
          h('div', { key: 'name', className: 'bt-connector-name' }, found.name),
          h('div', { key: 'hint', className: 'bt-set-hint' }, found.description || t('Read it before you add it. Bots will follow these instructions.')),
          h('pre', { key: 'text', className: 'bt-library-preview' }, found.content),
        ],
    error ? h('div', { className: 'bt-connector-error bt-connector-error-flush', role: 'alert' }, error) : null,
    h('div', { className: 'bt-connector-form-row' },
      h('span', { className: 'bt-connector-link' }),
      h('button', { type: 'button', className: 'bt-soft bt-soft-sm', disabled: busy, onClick: onClose }, t('Cancel')),
      found === null
        ? h('button', { type: 'button', className: 'bt-soft bt-soft-sm', disabled: busy || url.trim() === '', onClick: () => void read() }, busy ? t('Checking…') : t('Next'))
        : h('button', { type: 'button', className: 'bt-soft bt-soft-sm', disabled: busy, onClick: () => void save() }, t('Add'))))
}

const PAGES = {
  skill: { mark: BrainIcon, catalog: BUILT_IN_SKILLS, empty: 'No skills yet. Add one from Discover.', hint: 'Turn a skill on for a Bot in its settings.' },
}

// Settings → Skills. Packs saved earlier stay here beside the skills they gather.
export function LibraryPage({ kind, roster, actions, run }) {
  const page = PAGES[kind]
  const library = roster.capabilities ?? []
  const items = library.filter(item => item.kind === kind || item.kind === 'pack').sort((a, b) => a.name.localeCompare(b.name))
  const [tab, setTab] = useState(items.length > 0 ? 'mine' : 'discover')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(null)
  const [draft, setDraft] = useState(null)
  const Mark = page.mark
  const has = name => library.some(item => item.name === name)
  const saveSkill = skill => actions.saveCapability({ name: skill.name, kind: 'skill', description: skill.description, content: skill.content })
  const install = async (entry) => {
    await saveSkill(entry)
    setTab('mine')
  }
  const shown = tab === 'mine'
    ? items.filter(item => matches(query, item.name, item.description)).map(item => h(CapabilityCard, { key: item.name, item, mark: h(Mark), actions, run, onEdit: () => setDraft(capabilityDraft(item)) }))
    : page.catalog.filter(entry => !has(entry.name) && matches(query, t(entry.title), t(entry.description))).map(entry => h(DiscoverCard, { key: entry.name, entry, mark: h(Mark), install, run }))
  const panel = draft ? h(CapabilityForm, { draft, setDraft, items: library, actions, onClose: () => setDraft(null) })
    : adding === 'import' ? h(SkillImport, { actions, onClose: () => { setAdding(null); setTab('mine') } })
      : adding === 'choose' ? h('div', { className: 'bt-library-choices' },
          h('button', { type: 'button', className: 'bt-soft bt-soft-sm', onClick: () => { setAdding(null); setDraft({ ...blank(), kind: 'skill' }) } }, t('Write a skill')),
          h('button', { type: 'button', className: 'bt-soft bt-soft-sm', onClick: () => setAdding('import') }, t('Import from GitHub')),
          h('button', { type: 'button', className: 'bt-soft bt-soft-sm', onClick: () => setAdding(null) }, t('Cancel')))
        : null
  return h('section', { className: 'bt-set-section' },
    h(LibraryBar, { tab, onTab: setTab, query, onQuery: setQuery, onAdd: () => { if (kind === 'skill') setAdding('choose'); else setDraft({ ...blank(), kind }) } }),
    panel ? h('div', { className: 'bt-library-panel' }, panel) : null,
    tab === 'mine' && items.length > 0 ? h('p', { className: 'bt-set-hint' }, t(page.hint)) : null,
    h(LibraryGrid, { empty: t(tab === 'mine' && query === '' ? page.empty : 'Nothing found') }, shown))
}

export function BotCapabilitiesCard({ bot, roster, actions, run, Card, SwitchRow }) {
  const items = [...(roster.capabilities ?? [])].sort((a, b) => Number(b.kind === 'pack') - Number(a.kind === 'pack') || a.name.localeCompare(b.name))
  const attached = new Set(bot.capabilities ?? [])
  const statuses = roster.capabilityStatuses?.[bot.id] ?? {}
  if (items.length === 0) return null
  return h(Card, { title: t('Capabilities') },
    items.map(item => h(SwitchRow, {
      key: item.name,
      label: item.name,
      hint: attached.has(item.name) ? statusText(statuses[item.name]) : undefined,
      on: attached.has(item.name),
      onChange: enabled => void run(actions.setBotCapability(bot.id, item.name, enabled)),
    })))
}
