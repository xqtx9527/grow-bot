import { createElement as h, useEffect, useRef, useState } from 'react'
import { fnv1a, lookOf, shapeId } from './characters.js'
import { t } from './i18n.js'
import { INKS, isHex } from './inks.js'
import { frame, mixModels } from './vendor/blob-avatar/engine/frame.ts'
import { Gaze, lookTarget } from './vendor/blob-avatar/engine/gaze.ts'
import { SHAPES as BLOB_SHAPES } from './vendor/blob-avatar/engine/shapes.ts'
import { LiveSvg, toSvgString } from './vendor/blob-avatar/render/svg.ts'
import { avatarMotion, avatarCycle, idleDelay, nextIdleReaction } from './avatar-motion.js'
import { useMarkLife } from './mark-life.js'

const GROK_SHAPES = {
  'blob-circle': 'blob', 'blob-pebble': 'pebble', 'blob-squircle': 'squircle',
  'blob-capsule': 'capsule', 'blob-triangle': 'wedge', 'blob-diamond': 'gem',
  'blob-hexagon': 'hex', 'blob-star': 'star', 'blob-cloud': 'cloud',
  'blob-droplet': 'teardrop', 'blob-heart': 'heart', 'blob-flower': 'flower',
  'blob-leaf': 'leaf', 'blob-gem': 'gem',
  'blob-ghost': 'dome', 'blob-cat': 'cloud', 'blob-bear': 'clover', 'blob-bunny': 'bean',
  'blob-bubble': 'tablet', 'blob-cross': 'clover', 'blob-square': 'square',
  whale: 'blob', star: 'star', moon: 'teardrop', wave: 'dome', squircle: 'squircle',
  zed: 'shield', hex: 'hex', gumdrop: 'teardrop', peanut: 'bean', saucer: 'dome',
  ring: 'blob', gem: 'gem',
}

export { colorOf, lookOf } from './characters.js'

// -------------------------------------------------------------------------
// Bot mark: the Bot's character (or its uploaded photo), looked up by lookOf.

// Mascot states: what the Bot is doing picks the
// motion. Uploaded images only bob or hop, since they have no parts to move. `waiting`:
// no turn runs, but work it handed on has not come back yet.
const STATES = ['idle', 'thinking', 'searching', 'working', 'sending', 'orbit', 'waiting', 'alert', 'done']
export const botState = (running, activity, alert) => (alert ? 'alert'
  : running ? (activity?.switching ? 'thinking' : typeof activity?.tool === 'string' ? toolState(activity.tool) : STATES.includes(activity) && activity !== 'waiting' ? activity : activity?.speaking ? 'sending' : activity ? 'working' : 'thinking')
    : activity === 'waiting' ? 'waiting' : 'idle')
export const toolState = name => (/^(message_bot|stop_bot|create_bot|update_bot|create_group|update_group|delete_group|post_to_group)$/.test(name) ? 'sending'
  : /search|fetch|browse|read|grep|glob|list|recall/i.test(name) ? 'searching' : 'working')

// Eyes follow the pointer on large marks.
function useGaze(ref, enabled) {
  const pointer = useRef(null)
  useEffect(() => {
    if (!enabled) return undefined
    const onMove = event => { pointer.current = { x: event.clientX, y: event.clientY } }
    const onLeave = () => { pointer.current = null }
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [enabled])
  return pointer
}

// A mark moves for its state. `live` marks (sidebar, header, details) also answer the
// pointer, and at the lively motion level blink and fidget at rest (each Bot its own
// fidget and moment); transcript marks stay still so a long chat does not run dozens
// of animations.
const FIDGETS = ['hop', 'sway', 'stretch', 'look']
const BLOB_MAP = { blob: 'circle', pebble: 'pebble', squircle: 'squircle', tablet: 'capsule', wedge: 'triangle', cloud: 'cloud', teardrop: 'droplet', heart: 'heart', flower: 'flower', clover: 'clover', square: 'squircle', sparkle: 'star', house: 'ghost', star: 'star', hex: 'hexagon', bean: 'pebble', gem: 'gem', dome: 'ghost', shield: 'diamond', leaf: 'leaf', capsule: 'capsule' }
function blobShape(id) {
  const direct = id?.startsWith('blob-') ? id.slice(5) : null
  if (direct && BLOB_SHAPES.includes(direct)) return direct
  const old = id?.startsWith('grok-') ? id.slice(5) : GROK_SHAPES[id]
  return BLOB_MAP[old] ?? 'circle'
}
function avatarModel(shape, color, state, time, seed, still, reaction = null, look = null, open = 1) {
  const avatar = { v: 2, shape, color, expression: avatarMotion(state).expression, cycle: avatarCycle(state), seed }
  const model = frame(avatar, time, { still, react: reaction, look, open })
  model.eyes.forEach(eye => { eye.fill = '#fff' })
  return model
}
function blobMarkup(shape, color, size, state, time, seed, still) {
  return toSvgString(avatarModel(shape, color, state, time, seed, still), { size })
}
export function BotMark({ bot, look: given, size = 36, state = 'idle', live = false, gaze = false, pokeable = false, label }) {
  const look = given ?? lookOf(bot)
  const ref = useRef(null)
  const desiredMotion = useRef(state)
  desiredMotion.current = state
  const clickCount = useRef(0)
  // A photo that does not load shows the character instead; a new photo is tried again.
  const [broken, setBroken] = useState('')
  const image = look.image && look.image !== broken ? look.image : undefined
  const pointer = useGaze(ref, live && !image)
  const poke = useMarkLife(ref, live && !image, state)
  const selectedShape = blobShape(look.shape)
  const color = isHex(look.color) ? look.color : (INKS[look.color]?.[0] ?? '#959595')
  useEffect(() => {
    if (!live || image || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.body.dataset.btMotion === 'quiet') return undefined
    const element = ref.current
    if (!element) return undefined
    const svg = new LiveSvg(element.ownerDocument, { trails: 12, parts: 3 })
    svg.el.setAttribute('width', '100%')
    svg.el.setAttribute('height', '100%')
    element.replaceChildren(svg.el)
    const seed = fnv1a(String(bot?.id ?? look.shape))
    const gazeEngine = new Gaze(seed)
    let seenClicks = clickCount.current, clickAction = null
    let activeState = desiredMotion.current, started = performance.now(), previous = null, transition = 0
    let visible = true, request = 0, last = 0, lastModel = null
    let idleAction = null, lastAction = '', nextAction = started + idleDelay()
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true }) : null
    observer?.observe(element)
    const animate = now => {
      if (visible && !document.hidden && now - last >= 33) {
        last = now
        // A Bot left alone dozes off the way one waiting for work does.
        const wanted = element.dataset.rest === 'sleepy' ? 'waiting' : desiredMotion.current
        if (activeState !== wanted) {
          previous = lastModel
          activeState = wanted
          started = now
          transition = now
          idleAction = null
          nextAction = now + idleDelay()
        }
        if (seenClicks !== clickCount.current) {
          seenClicks = clickCount.current
          clickAction = { anim: 'wink', dur: 1.1, started: now }
          idleAction = null
          nextAction = now + idleDelay()
        }
        if (clickAction && now - clickAction.started >= clickAction.dur * 1000) clickAction = null
        if (activeState === 'idle' && !idleAction && !clickAction && now >= nextAction) {
          const action = nextIdleReaction(lastAction)
          idleAction = { ...action, started: now }
          lastAction = action.anim
        }
        if (idleAction && now - idleAction.started >= idleAction.dur * 1000) {
          idleAction = null
          nextAction = now + idleDelay()
        }
        const action = clickAction ?? (activeState === 'idle' ? idleAction : null)
        const reaction = action ? { anim: action.anim, dur: action.dur, hop: action.hop, t: (now - action.started) / 1000 } : null
        const point = pointer.current
        const box = element.getBoundingClientRect()
        const nearby = point && Math.hypot(point.x - box.left - box.width / 2, point.y - box.top - box.height / 2) < 180
        const target = nearby ? lookTarget(point.x, point.y, box) : null
        const eyeLook = gazeEngine.step(target, 1 / 30)
        let model = avatarModel(selectedShape, color, activeState, (now - started) / 1000, seed, false, reaction, eyeLook, gazeEngine.open)
        if (previous && now - transition < 300) {
          const t = Math.max(0, (now - transition) / 300)
          model = mixModels(previous, model, t * t * (3 - 2 * t))
        } else previous = null
        svg.update(model)
        lastModel = model
      }
      request = requestAnimationFrame(animate)
    }
    request = requestAnimationFrame(animate)
    return () => { cancelAnimationFrame(request); observer?.disconnect() }
  }, [selectedShape, image, live, color, size])
  const common = {
    ref,
    className: 'bt-mark',
    'data-shape': image ? 'image' : shapeId(look.shape),
    'data-state': STATES.includes(state) ? state : 'idle',
    'data-live': live ? '' : undefined,
    'data-fidget': live ? FIDGETS[fnv1a(`${bot?.id ?? ''}:fidget`) % FIDGETS.length] : undefined,
    'data-gaze': gaze ? '' : undefined,
    'data-poke': pokeable ? '' : undefined,
    // A state's small sign needs room above the character.
    'data-sign': live && !image && size >= 40 ? '' : undefined,
    style: { width: size, height: size, ...(live ? { '--bt-delay': `${-(fnv1a(String(bot?.id ?? '')) % 5000) / 1000}s`, '--bt-fidget-delay': `${-(fnv1a(`${bot?.id ?? ''}:when`) % 9000) / 1000}s` } : {}) },
    role: label ? 'img' : undefined,
    'aria-label': label,
    'aria-hidden': label ? undefined : true,
    onClick: live && !image ? () => { clickCount.current += 1; poke() } : undefined,
  }
  if (image) return h('span', common, h('img', { className: 'bt-mark-img', src: image, alt: '', draggable: false, onError: () => setBroken(image) }))
  const svg = blobMarkup(selectedShape, color, size, 'idle', 0, fnv1a(String(bot?.id ?? look.shape)), true)
  return h('span', { ...common, dangerouslySetInnerHTML: { __html: svg } })
}

function StarIcon({ size = 8 }) {
  return h('svg', { width: size, height: size, viewBox: '0 0 10 10', 'aria-hidden': true },
    h('path', { d: 'M5 .6l1.3 2.8 3 .3-2.3 2 .7 3L5 7.2 2.3 8.7l.7-3L.7 3.7l3-.3z', fill: '#fff' }))
}
// The small star in a disc that marks a group admin, beside a name.
export function AdminStar() {
  return h('span', { className: 'bt-admin-star', role: 'img', 'aria-label': t('Admin') }, h(StarIcon, { size: 7 }))
}
// A Main Bot wears a large solid star; a group admin wears the small star in a disc.
function MainStar() {
  return h('svg', { viewBox: '0 0 20 20', 'aria-hidden': true },
    h('path', { d: 'M10 2.4l2.29 5.04 5.51.63-4.09 3.74 1.11 5.42L10 14.5l-4.82 2.73 1.11-5.42L2.2 8.07l5.51-.63z' }))
}

// Marks settle with a short squash when a run finishes.
function useSettled(state) {
  const prev = useRef(state)
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const was = prev.current
    prev.current = state
    if (state !== 'idle') { setSettled(false); return undefined }
    if (was === 'idle' || was === 'alert') return undefined
    setSettled(true)
    const timer = setTimeout(() => setSettled(false), 1800)
    return () => clearTimeout(timer)
  }, [state])
  return settled
}

export function BotAvatar({ bot, size, state = 'idle', main, admin, badge = true, live = true, gaze = false, pokeable = false }) {
  const settled = useSettled(state)
  if (bot === undefined) return h(BotMark, { size })
  const badgeKind = !badge ? null : state === 'alert' ? 'alert' : state !== 'idle' && state !== 'waiting' ? 'working' : admin ? 'admin' : main ? 'main' : null
  return h('span', { className: 'bt-mark', style: { width: size, height: size, '--bt-size': `${size}px` } },
    h(BotMark, { bot, size, state: settled ? 'done' : state, live, gaze, pokeable }),
    badgeKind === 'working' ? h('span', { className: 'bt-badge bt-badge-working', 'aria-label': t('Working'), role: 'img' }) : null,
    badgeKind === 'alert' ? h('span', { className: 'bt-badge bt-badge-alert', 'aria-label': t('Waiting for your answer'), role: 'img' }, '?') : null,
    badgeKind === 'admin' ? h('span', { className: 'bt-badge bt-badge-admin', 'aria-label': t('Admin'), role: 'img' }, h(StarIcon)) : null,
    badgeKind === 'main' ? h('span', { className: 'bt-badge bt-badge-main', 'aria-label': t('Main Bot'), role: 'img' }, h(MainStar)) : null)
}

// A group avatar seats its members' characters in the frame: two on a
// diagonal, three in a triangle, four in a grid, and past four three plus a "+N" seat.
function clusterSeats(count, frame) {
  if (count === 1) return [[0, 0, frame]]
  if (count === 2) return [[0, 0, frame * 2 / 3], [frame / 3, frame / 3, frame * 2 / 3]]
  if (count === 3) {
    const size = frame * 5 / 9
    const rest = frame - size
    return [[rest / 2, 0, size], [0, rest, size], [rest, rest, size]]
  }
  const half = frame / 2
  return [[0, 0, half], [half, 0, half], [0, half, half], [half, half, half]]
}

export function RoomAvatar({ room, roster, size = 36 }) {
  const members = room.members.map(id => roster.byId[id]).filter(Boolean)
  // A group with one Bot left shows the user beside it.
  const people = members.length === 1 ? [members[0], null] : members
  const seat = (bot, seatSize, key) => (bot
    ? h(BotMark, { key, bot, size: seatSize })
    : h('span', { key, className: 'bt-cluster-you', style: { width: seatSize * 0.92, height: seatSize * 0.92, margin: seatSize * 0.04 } }))
  if (people.length === 0) return h(BotMark, { size })
  // Inline sizes have no room for a cluster, so the members line up instead.
  if (size <= 20 && people.length > 1) {
    return h('span', { className: 'bt-stack', style: { '--bt-stack-size': `${size}px` } },
      people.slice(0, 3).map((bot, index) => seat(bot, size, bot?.id ?? `you-${index}`)),
      people.length > 3 ? h('span', { className: 'bt-stack-more' }, `+${people.length - 3}`) : null)
  }
  const seats = clusterSeats(Math.min(people.length, 4), size)
  const overflow = people.length > 4 ? people.length - 3 : 0
  // A later seat cuts a gap of frame/14 into each seat it overlaps.
  const gap = size / 14
  const rings = seats.map(([x, y, s]) => ({ cx: x + s / 2, cy: y + s / 2, r: s * 0.48 + gap }))
  return h('span', { className: 'bt-cluster', style: { width: size, height: size } },
    seats.map(([x, y, s], index) => {
      const holes = rings.slice(index + 1)
        .filter(ring => Math.hypot(ring.cx - x - s / 2, ring.cy - y - s / 2) < ring.r + s * 0.46)
        .map(ring => `radial-gradient(circle at ${ring.cx - x}px ${ring.cy - y}px,transparent ${ring.r}px,#000 ${ring.r + 0.5}px)`)
      const style = { left: x, top: y, width: s, height: s }
      if (holes.length > 0) Object.assign(style, { WebkitMaskImage: holes.join(','), maskImage: holes.join(','), WebkitMaskComposite: 'source-in', maskComposite: 'intersect' })
      if (overflow > 0 && index === 3) {
        return h('span', { key: 'more', className: 'bt-cluster-more', style: { ...style, width: s * 0.92, height: s * 0.92, margin: s * 0.04, fontSize: Math.max(8, Math.round(s * 0.36)) } }, `+${overflow}`)
      }
      const bot = people[index]
      return h('span', { key: bot?.id ?? 'you', style }, seat(bot, s))
    }))
}
