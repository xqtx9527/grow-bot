import { createElement as h, useEffect, useRef, useState } from 'react'
import { BotMark } from './mark.js'
import { CharacterGrid } from './bot-settings.js'
import { DEFAULT_SHAPES, DEFAULT_COLORS, CREATE_SHAPES } from './characters.js'
import { ChevronLeftIcon, CloseIcon } from './icons.js'
import { useEscape } from './overlay-hooks.js'
import { createPayload, freshBotName, startModel } from './bot-draft.js'
import { ModelMenu } from './model-menu.js'
import { hostText, t } from './i18n.js'
import { nameProblem } from '../shared/mentions.js'
import { paintCss } from './inks.js'

const pick = list => list[Math.floor(Math.random() * list.length)]
const randomLook = (avoid = {}) => {
  const shapes = DEFAULT_SHAPES.filter(shape => shape !== avoid.shape)
  const colors = DEFAULT_COLORS.filter(color => color !== avoid.color)
  return { shape: pick(shapes), color: pick(colors) }
}

// The new-Bot form: look first, then name and model. Nothing exists until Create.
// `inline` drops the pane's header for a form shown inside Settings.
export function CreateBot({ roster, actions, start, brief = '', onBack, canGoBack, onCreated, inline = false, bodyOnly = false, typeSelector = null }) {
  const [look, setLook] = useState(() => randomLook())
  const [name, setName] = useState(start?.name ?? '')
  const [model, setModel] = useState(() => startModel(roster))
  const [effort, setEffort] = useState(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const frame = useRef(null)
  useEscape(bodyOnly ? undefined : onBack)
  // Inside Settings the form opens below other sections, so it scrolls itself into view.
  useEffect(() => { if (inline) frame.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }, [])
  const fallbackName = freshBotName(roster, t('New Bot'))
  const finalName = name.trim() || fallbackName
  const clash = roster.bots.some(bot => bot.name.toLowerCase() === finalName.toLowerCase())
  const problem = nameProblem(finalName)
  const create = async () => {
    if (busy || clash || problem) return
    setError('')
    setBusy(true)
    try {
      const bot = await actions.createBot(createPayload({ name: finalName, look, model, effort, brief }))
      onCreated(bot)
    } catch (failure) {
      setError(failure?.message ?? String(failure))
      setBusy(false)
    }
  }
  const previewLook = look
  const body = h('div', { className: 'bt-create-body' },
    h('div', { className: 'bt-create-preview' },
      h('span', { key: `${look.shape}:${look.color}`, className: 'bt-create-pop' },
        h(BotMark, { look: previewLook, bot: { id: 'new-bot' }, size: 88, live: true, gaze: true, pokeable: true }))),
    h('input', {
      className: 'bt-create-input', autoFocus: !inline, value: name, placeholder: t('Name this Bot'), maxLength: 40, 'aria-label': t('Name'),
      onChange: event => setName(event.target.value),
      onKeyDown: (event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void create() } },
    }),
    problem ? h('span', { className: 'bt-note bt-danger' }, hostText(problem))
      : clash ? h('span', { className: 'bt-note bt-danger' }, t('A Bot named {name} already exists', { name: finalName })) : null,
    h('div', { className: 'bt-create-looks' },
      h(CharacterGrid, {
        look, hasPhoto: false, shapes: CREATE_SHAPES, markSize: 56,
        onShape: (shape) => setLook(current => ({ ...current, shape })),
        onColor: (color) => setLook(current => ({ ...current, color })),
      })),
    h('div', { className: 'bt-create-model' },
      h('span', { className: 'bt-create-model-label' }, t('Model')),
      h(ModelMenu, { bot: { id: 'new-bot', name: finalName, model: model || undefined, effort }, roster, actions, wide: true, onPick: ref => { setModel(ref); setEffort(undefined) }, onPickEffort: picked => setEffort(picked ?? null) })),
    error ? h('div', { className: 'bt-error', role: 'alert', style: { padding: 0 } }, error) : null,
    h('div', { className: 'bt-create-foot' },
      h('button', { type: 'button', className: 'bt-soft', onClick: onBack }, t('Cancel')),
      h('button', { type: 'button', className: 'bt-send bt-create-go', style: { background: paintCss(look.color), color: '#fff' }, disabled: busy || clash || Boolean(problem), onClick: () => void create() }, busy ? t('Creating…') : t('Create'))))

  if (bodyOnly) return body
  const card = h('div', { className: 'bt-create-card' },
    inline ? null : h('div', { className: 'bt-create-head' },
      h('span', { className: 'bt-create-title' }, t('Create Bot')),
      h('button', { type: 'button', className: 'bt-icon-btn', 'aria-label': t('Close'), onClick: () => actions.closeOverlay() }, h(CloseIcon))),
    typeSelector,
    body)
  if (inline) return h('div', { ref: frame, className: 'bt-create-inline', role: 'group', 'aria-label': t('Create Bot') }, card)
  return h('div', { className: 'bt-create', role: 'dialog', 'aria-label': t('Create Bot') }, card)
}
