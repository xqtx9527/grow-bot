// The frame Skills, Connectors and Plugins share: what is yours, what can be added, a search
// and an add button, over a two-column grid of cards.
import { createElement as h } from 'react'
import { PlusIcon, SearchIcon } from './icons.js'
import { t } from './i18n.js'

export const matches = (query, ...texts) => {
  const wanted = query.trim().toLowerCase()
  return wanted === '' || texts.some(text => String(text ?? '').toLowerCase().includes(wanted))
}

export function LibraryBar({ tab, onTab, query, onQuery, onAdd }) {
  return h('div', { className: 'bt-library-bar' },
    h('div', { className: 'bt-library-tabs', role: 'tablist' }, [['mine', t('Mine')], ['discover', t('Discover')]].map(([id, label]) => h('button', {
      key: id, type: 'button', role: 'tab', 'aria-selected': tab === id, onClick: () => onTab(id),
    }, label))),
    h('label', { className: 'bt-library-search' }, h(SearchIcon),
      h('input', { value: query, placeholder: t('Search'), 'aria-label': t('Search'), spellCheck: false, onChange: event => onQuery(event.target.value) })),
    h('button', { type: 'button', className: 'bt-library-add', onClick: onAdd }, h(PlusIcon), t('Add')))
}

export const LibraryGrid = ({ empty, children }) => (children.length === 0
  ? h('div', { className: 'bt-library-empty' }, empty)
  : h('div', { className: 'bt-library-grid' }, children))

export function LibraryCard({ mark, title, text, children }) {
  return h('div', { className: 'bt-connector' },
    h('div', { className: 'bt-connector-head' },
      h('span', { className: 'bt-connector-mark' }, mark),
      h('span', { className: 'bt-connector-text' },
        h('span', { className: 'bt-connector-name' }, title),
        h('span', { className: 'bt-connector-status' }, text)),
      h('span', { className: 'bt-connector-actions' }, children)))
}

export const LIBRARY_CSS = `
.bt-library-bar{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.bt-library-tabs{display:flex;gap:2px;padding:3px;border-radius:999px;background:var(--bt-hover)}
.bt-library-tabs button{height:28px;padding:0 14px;border:0;border-radius:999px;background:none;color:var(--bt-ink-2);font:inherit;font-size:13px;cursor:pointer}
.bt-library-tabs button[aria-selected=true]{background:var(--bt-main);color:var(--bt-ink);font-weight:500}
.bt-library-search{flex:1;min-width:0;display:flex;align-items:center;gap:8px;height:34px;padding:0 12px;border:.5px solid var(--bt-line-2);border-radius:999px;color:var(--bt-ink-3)}
.bt-library-search input{flex:1;min-width:0;border:0;outline:0;background:none;color:var(--bt-ink);font:inherit;font-size:13px}
.bt-library-add{flex:none;display:flex;align-items:center;gap:4px;height:34px;padding:0 14px 0 10px;border:0;border-radius:999px;background:var(--bt-ink);color:var(--bt-main);font:inherit;font-size:13px;cursor:pointer}
.bt-library-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.bt-library-grid>.bt-connector{min-width:0;padding:14px;border-radius:var(--bt-r-pop,22px);background:var(--bt-sidebar);border-bottom:0!important}
.bt-library-grid>.bt-connector:has(.bt-connector-form,.bt-connector-signin){grid-column:1/-1}
.bt-library-grid .bt-connector-mark{background:var(--bt-main)}
.bt-library-grid .bt-connector-status{white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.bt-library-grid .bt-connector-add{background:var(--bt-main)}
.bt-library-empty{padding:48px 16px;text-align:center;font-size:13px;color:var(--bt-ink-3)}
.bt-library-panel{margin-bottom:16px;padding:16px;border-radius:var(--bt-r-pop,22px);background:var(--bt-sidebar)}
.bt-library-panel .bt-connector-form{padding-left:0}
.bt-library-choices{display:flex;flex-wrap:wrap;gap:8px}
.bt-library-preview{max-height:220px;overflow:auto;margin:0;padding:12px;border-radius:12px;background:var(--bt-main);font-size:12px;line-height:18px;white-space:pre-wrap;overflow-wrap:anywhere}
@media (max-width:760px){.bt-library-grid{grid-template-columns:minmax(0,1fr)}}
`
