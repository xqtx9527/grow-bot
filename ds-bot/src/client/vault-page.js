// Settings → Vault: saved sign-ins, cards and keys, all in one place.
import { createElement as h, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CardIcon, ChevronRightIcon, CloseIcon, ImportIcon, PlusIcon, SearchIcon } from './icons.js'
import { hostText, t } from './i18n.js'
import { KeyIcon, MaskedInput, SecretsPage } from './secret-card.js'
import { matches } from './library-page.js'

const TABS = [['all', 'All'], ['login', 'Logins'], ['card', 'Payment'], ['key', 'Keys']]
const BLANK = {
  login: { kind: 'login', sites: [''], username: '', password: '', hint: '' },
  card: { kind: 'card', number: '', expiry: '', securityCode: '', holder: '', nickname: '', billingAddress: '', hint: '' },
}
const TITLES = { login: ['New login', 'Edit login'], card: ['New card', 'Edit card'] }
const SAVE = { login: 'Save login', card: 'Save card' }
const FOOT = { login: 'Grow Bot can use this login to sign in for you. Models never see the password.', card: 'Grow Bot never sees the card number.' }
const ICONS = { login: KeyIcon, card: CardIcon }

const titleOf = item => (item.kind === 'login' ? item.sites.join(', ') : item.nickname || `•••• ${item.last4}`)
const detailOf = item => (item.kind === 'login' ? item.username : [item.holder, item.expiry].filter(Boolean).join(' · '))

const Field = ({ label, optional, children }) => h('div', { className: 'bt-vault-field' },
  h('span', { className: 'bt-vault-label' }, t(label), optional ? h('span', null, ` (${t('optional')})`) : null), children)

function Input({ draft, set, name, label, optional, placeholder, multiline }) {
  return h(Field, { label, optional }, h(multiline ? 'textarea' : 'input', { className: multiline ? 'bt-input bt-input-area' : 'bt-input', value: draft[name] ?? '', placeholder, spellCheck: false, 'aria-label': t(label), onChange: event => set(name, event.target.value) }))
}

const Hint = ({ draft, set }) => h(Field, { label: 'Hint', optional: true },
  h('input', { className: 'bt-input', value: draft.hint ?? '', spellCheck: false, 'aria-label': t('Hint'), onChange: event => set('hint', event.target.value) }),
  h('span', { className: 'bt-vault-help' }, t('Tell Bots when to use this item')))

function LoginFields({ draft, set, editing }) {
  const sites = draft.sites ?? ['']
  const setSite = (index, value) => set('sites', sites.map((site, at) => (at === index ? value : site)))
  return [
    h(Field, { key: 'sites', label: 'Website' },
      sites.map((site, index) => h('span', { key: index, className: 'bt-vault-site' },
        h(KeyIcon), h('input', { value: site, autoFocus: index === 0, spellCheck: false, placeholder: 'example.com', 'aria-label': t('Website'), onChange: event => setSite(index, event.target.value) }),
        sites.length > 1 ? h('button', { type: 'button', 'aria-label': t('Remove'), onClick: () => set('sites', sites.filter((_, at) => at !== index)) }, h(CloseIcon)) : null)),
      h('button', { type: 'button', className: 'bt-soft bt-soft-sm bt-vault-more', onClick: () => set('sites', [...sites, '']) }, h(PlusIcon), t('Add website'))),
    h(Input, { key: 'user', draft, set, name: 'username', label: 'Username or email', optional: true, placeholder: 'name@example.com' }),
    h(Field, { key: 'pass', label: editing ? 'New password (leave empty to keep)' : 'Password' }, h('label', { className: 'bt-q-field bt-secret-field' }, h(MaskedInput, { value: draft.password ?? '', onChange: value => set('password', value), label: t('Password'), placeholder: '' }))),
    h(Hint, { key: 'hint', draft, set }),
  ]
}

function CardFields({ draft, set, editing, actions }) {
  const [shown, setShown] = useState(null)
  const [address, setAddress] = useState(Boolean(draft.billingAddress))
  const reveal = () => { if (shown) setShown(null); else void actions.vaultReveal(draft.id).then(setShown) }
  return [
    h(Field, { key: 'number', label: editing ? 'New card number (leave empty to keep)' : 'Card number' }, h('input', { className: 'bt-input', value: draft.number ?? '', autoFocus: !editing, inputMode: 'numeric', autoComplete: 'off', spellCheck: false, placeholder: editing ? `•••• ${draft.last4}` : undefined, 'aria-label': t('Card number'), onChange: event => set('number', event.target.value) })),
    editing ? h('div', { key: 'reveal', className: 'bt-vault-reveal' }, shown ? h('code', null, shown.number, shown.securityCode ? ` · ${shown.securityCode}` : '') : null,
      h('button', { type: 'button', className: 'bt-soft bt-soft-sm', onClick: reveal }, t(shown ? 'Hide' : 'Show'))) : null,
    h('div', { key: 'two', className: 'bt-vault-two' },
      h(Input, { draft, set, name: 'expiry', label: 'Expiry', placeholder: t('MM / YY') }),
      h(Field, { label: 'Security code', optional: true }, h('label', { className: 'bt-q-field bt-secret-field' }, h(MaskedInput, { value: draft.securityCode ?? '', onChange: value => set('securityCode', value), label: t('Security code'), placeholder: '' })))),
    h('div', { key: 'names', className: 'bt-vault-two' },
      h(Input, { draft, set, name: 'holder', label: 'Cardholder name', optional: true }),
      h(Input, { draft, set, name: 'nickname', label: 'Nickname', optional: true, placeholder: t('For example: Travel') })),
    address ? h(Input, { key: 'address', draft, set, name: 'billingAddress', label: 'Billing address', optional: true, multiline: true })
      : h('button', { key: 'addr', type: 'button', className: 'bt-vault-wide', onClick: () => setAddress(true) }, h(PlusIcon), t('Add billing address'), h('span', null, ` (${t('optional')})`)),
    h(Hint, { key: 'hint', draft, set }),
  ]
}

const FORMS = { login: LoginFields, card: CardFields }

function ItemDialog({ draft, setDraft, actions, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const editing = draft.id !== undefined
  const set = (key, value) => setDraft({ ...draft, [key]: value })
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); onDone() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
  const attempt = async (task) => {
    setBusy(true)
    setError('')
    try { onDone(await task()) } catch (failure) { setError(hostText(failure?.message ?? String(failure))); setBusy(false) }
  }
  return createPortal(h('div', { className: 'bt-vault-layer' },
    h('div', { className: 'bt-vault-scrim', onMouseDown: () => onDone() }),
    h('div', { className: 'bt-vault-dialog', role: 'dialog', 'aria-modal': true, 'aria-label': t(TITLES[draft.kind][editing ? 1 : 0]) },
      h('div', { className: 'bt-vault-dialog-head' }, h('h3', null, t(TITLES[draft.kind][editing ? 1 : 0])),
        h('button', { type: 'button', className: 'bt-icon-btn', 'aria-label': t('Close'), onClick: () => onDone() }, h(CloseIcon))),
      h('div', { className: 'bt-vault-dialog-body' }, h(FORMS[draft.kind], { draft, set, editing, actions }),
        error ? h('div', { className: 'bt-connector-error bt-connector-error-flush', role: 'alert' }, error) : null),
      h('div', { className: 'bt-vault-dialog-foot' },
        h('span', { className: 'bt-vault-help' }, t(FOOT[draft.kind])),
        editing ? h('button', { type: 'button', className: 'bt-soft bt-soft-sm bt-secret-danger', disabled: busy, onClick: () => void attempt(() => actions.vaultDelete(draft.id)) }, t('Delete')) : null,
        h('button', { type: 'button', className: 'bt-library-add bt-vault-save', disabled: busy, onClick: () => void attempt(() => actions.vaultSave(draft)) }, t(SAVE[draft.kind]))))), document.body)
}

export function VaultPage({ roster, actions, run, Section }) {
  const [saved, setSaved] = useState(null)
  const vault = saved ?? roster.vault ?? { available: false, items: [] }
  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState(null)
  const [menu, setMenu] = useState(false)
  const [note, setNote] = useState('')
  const file = useRef(null)
  const keys = roster.secrets ?? []
  const count = kind => vault.items.filter(item => item.kind === kind).length
  const counts = { all: vault.items.length + keys.length, login: count('login'), card: count('card'), key: keys.length }
  const shown = vault.items.filter(item => (tab === 'all' || tab === item.kind) && matches(query, titleOf(item), detailOf(item)))
  const done = (view) => { if (view?.items) setSaved(view); setDraft(null) }
  const start = (kind) => { setMenu(false); setDraft(structuredClone(BLANK[kind])) }
  const imported = (event) => {
    const chosen = event.target.files?.[0]
    event.target.value = ''
    if (!chosen) return
    void run(chosen.text().then(actions.vaultImport).then((view) => {
      setSaved(view)
      setNote(t('Imported {added} logins. {skipped} rows skipped.', { added: view.imported.added, skipped: view.imported.skipped }))
    }))
  }
  const choice = (Icon, label, onClick) => h('button', { type: 'button', role: 'menuitem', onClick }, h(Icon), t(label))
  return [
    h('div', { key: 'head', className: 'bt-vault-head' }, vault.available ? h('div', { className: 'bt-vault-new' },
      h('button', { type: 'button', className: 'bt-library-add', 'aria-haspopup': 'menu', 'aria-expanded': menu, onClick: () => setMenu(!menu) }, t('New item'), ' ▾'),
      menu ? h('div', { className: 'bt-vault-menu', role: 'menu' },
        choice(KeyIcon, 'Login', () => start('login')), choice(CardIcon, 'Card', () => start('card')),
        h('hr'), choice(ImportIcon, 'Import', () => { setMenu(false); file.current?.click() })) : null,
      h('input', { ref: file, type: 'file', accept: '.csv,text/csv', hidden: true, onChange: imported })) : null),
    h('div', { key: 'bar', className: 'bt-vault-bar' },
      h('div', { className: 'bt-vault-tabs', role: 'tablist' }, TABS.map(([id, label]) => h('button', { key: id, type: 'button', role: 'tab', 'aria-selected': tab === id, onClick: () => setTab(id) }, t(label), ' ', h('span', null, counts[id])))),
      h('label', { className: 'bt-library-search' }, h(SearchIcon), h('input', { value: query, placeholder: t('Search the vault'), 'aria-label': t('Search the vault'), spellCheck: false, onChange: event => setQuery(event.target.value) }))),
    !vault.available ? h('p', { key: 'off', className: 'bt-set-hint' }, t('The vault needs the desktop app, which keeps its key in the system keychain.')) : null,
    note ? h('p', { key: 'note-import', className: 'bt-set-hint' }, note) : null,
    draft ? h(ItemDialog, { key: 'dialog', draft, setDraft, actions, onDone: done }) : null,
    tab !== 'key' ? h('div', { key: 'list', className: 'bt-vault-list' }, shown.length === 0
      ? h('div', { className: 'bt-library-empty' }, t(query === '' ? 'Nothing saved yet.' : 'Nothing found'))
      : shown.map(item => h('button', { key: item.id, type: 'button', className: 'bt-vault-row', onClick: () => setDraft({ ...structuredClone(item), number: '', securityCode: '', password: '' }) },
          h('span', { className: 'bt-connector-mark' }, h(ICONS[item.kind])),
          h('span', { className: 'bt-connector-text' },
            h('span', { className: 'bt-connector-name' }, titleOf(item)),
            h('span', { className: 'bt-connector-status' }, detailOf(item))),
          h(ChevronRightIcon)))) : null,
    tab === 'key' || tab === 'all' ? h('div', { key: 'keys' }, h(SecretsPage, { roster, actions, run, Section })) : null,
    h('p', { key: 'note', className: 'bt-set-hint bt-vault-note' }, t('Saved on this computer, encrypted with a key in your system keychain. Models never see a password or a card number: Grow Bot types a password into the page itself, only on the site it was saved for, after you allow each Bot once.')),
  ]
}

export const VAULT_CSS = `
.bt-vault-head{position:absolute;top:18px;right:72px;z-index:3}
.bt-vault-new{position:relative}
.bt-vault-menu{position:absolute;top:calc(100% + 8px);right:0;z-index:4;width:210px;padding:8px;display:flex;flex-direction:column;gap:2px;background:var(--bt-main);box-shadow:0 8px 28px color-mix(in srgb,var(--bt-ink) 16%,transparent)}
.bt-vault-menu button{display:flex;align-items:center;gap:10px;padding:9px 10px;border:0;background:none;color:var(--bt-ink);font:inherit;font-size:14px;text-align:left;cursor:pointer}
.bt-vault-menu button:hover{background:var(--bt-hover)}
.bt-vault-menu hr{width:100%;margin:4px 0;border:0;border-top:.5px solid var(--bt-line)}
.bt-vault-bar{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.bt-vault-tabs{display:flex;gap:2px}
.bt-vault-tabs button{height:32px;padding:0 12px;border:0;border-radius:999px;background:none;color:var(--bt-ink-2);font:inherit;font-size:13px;white-space:nowrap;cursor:pointer}
.bt-vault-tabs button span{color:var(--bt-ink-3)}
.bt-vault-tabs button[aria-selected=true]{background:var(--bt-hover);color:var(--bt-ink);font-weight:500}
.bt-vault-list{margin-bottom:16px;border:.5px solid var(--bt-line);border-radius:var(--bt-r-card,28px);overflow:hidden}
.bt-vault-row{display:flex;align-items:center;gap:12px;width:100%;padding:12px 16px;border:0;border-bottom:.5px solid var(--bt-line);background:none;color:var(--bt-ink-3);font:inherit;text-align:left;cursor:pointer}
.bt-vault-row:last-child{border-bottom:0}
.bt-vault-row:hover{background:var(--bt-hover)}
.bt-vault-row .bt-connector-name{color:var(--bt-ink)}
.bt-vault-note{margin-top:12px}
.bt-vault-layer{position:fixed;inset:0;z-index:90;display:grid;place-items:center}
.bt-vault-scrim{position:absolute;inset:0;background:color-mix(in srgb,var(--bt-ink) 32%,transparent)}
.bt-vault-dialog{position:relative;width:min(520px,calc(100vw - 32px));max-height:calc(100vh - 48px);display:flex;flex-direction:column;background:var(--bt-main);color:var(--bt-ink)}
.bt-vault-dialog-head{display:flex;align-items:center;justify-content:space-between;padding:18px 22px 8px}
.bt-vault-dialog-head h3{margin:0;font-size:17px;font-weight:600}
.bt-vault-dialog-body{display:flex;flex-direction:column;gap:12px;padding:8px 22px 12px;overflow:auto}
.bt-vault-dialog-foot{display:flex;align-items:center;gap:10px;padding:12px 22px 18px}
.bt-vault-dialog-foot .bt-vault-help{flex:1}
.bt-vault-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.bt-vault-label{font-size:13px;color:var(--bt-ink-2)}
.bt-vault-label span,.bt-vault-wide span{color:var(--bt-ink-3)}
.bt-vault-help{font-size:12px;color:var(--bt-ink-3)}
.bt-vault-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.bt-vault-site{display:flex;align-items:center;gap:8px;height:38px;padding:0 12px;border:.5px solid var(--bt-line-2);border-radius:var(--bt-r-field,18px);color:var(--bt-ink-3)}
.bt-vault-site input{flex:1;min-width:0;border:0;outline:0;background:none;color:var(--bt-ink);font:inherit;font-size:14px}
.bt-vault-site button{padding:0;border:0;background:none;color:var(--bt-ink-3);cursor:pointer}
.bt-vault-more{align-self:flex-start;display:inline-flex;align-items:center;gap:4px}
.bt-vault-wide{display:flex;align-items:center;gap:6px;height:38px;padding:0 12px;border:.5px solid var(--bt-line-2);border-radius:var(--bt-r-field,18px);background:none;color:var(--bt-ink);font:inherit;font-size:13px;cursor:pointer}
.bt-vault-reveal{display:flex;align-items:center;justify-content:flex-end;gap:10px}
.bt-vault-save:disabled{opacity:.5;cursor:default}
`
