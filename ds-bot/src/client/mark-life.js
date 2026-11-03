import { useCallback, useEffect, useRef } from 'react'
import { reducedMotion } from './motion.js'

// What the avatar engine does not cover: a live mark leans to the pointer, answers clicks and
// stroking and dozes off when left alone. All of it writes to the mark's element, not to
// React, so a moving pointer renders nothing.

const REACTION_MS = { hop: 700, wiggle: 800, spin: 900, dizzy: 1500, love: 1300, perk: 600, surprise: 800, wake: 700 }
const POKES = ['hop', 'wiggle', 'spin']
const POKE_WINDOW_MS = 1400
const LEAN_REACH = 220
const STROKE_DISTANCE = 420
const STROKE_WINDOW_MS = 1600
const SLEEPY_MS = 5 * 60_000
const REST_CHECK_MS = 20_000
const SPARKS = { love: '♥', dizzy: '✦', done: '✦' }
// Below this a spark would be larger than the Bot.
const SPARK_MIN_SIZE = 28
const clamp = (value, low, high) => Math.min(high, Math.max(low, value))

/** The reaction to the count-th quick click: each climbs higher, and too many make it dizzy. */
export const pokeReaction = count => (count > POKES.length ? 'dizzy' : POKES[Math.max(0, count - 1)])

/** How a mark leans to a pointer within reach, in percent and degrees; null when out of reach. */
export function leanOf(box, point, reach = LEAN_REACH) {
  if (!point) return null
  const dx = point.x - (box.left + box.width / 2)
  const dy = point.y - (box.top + box.height / 2)
  if (Math.hypot(dx, dy) > reach) return null
  const x = clamp(dx / reach, -1, 1)
  const y = clamp(dy / reach, -1, 1)
  return { x: x * 6, y: y * 4, tilt: x * 10 }
}

/** The reaction when a Bot's state changes, or null: starting work perks it up, a question startles it. */
export function stateReaction(previous, state) {
  if (state === previous) return null
  if (state === 'alert') return 'surprise'
  if (previous === 'idle' && state !== 'done') return 'perk'
  return null
}

const motionAllowed = () => !reducedMotion() && document.body.dataset.btMotion !== 'quiet'

function spark(element, glyph) {
  if (element.getBoundingClientRect().width < SPARK_MIN_SIZE) return
  for (const [index, drift] of [-1, 0, 1].entries()) {
    const fx = element.ownerDocument.createElement('span')
    fx.className = 'bt-mark-fx'
    fx.textContent = glyph
    fx.setAttribute('aria-hidden', 'true')
    fx.style.setProperty('--bt-fx-x', `${drift * 90}%`)
    fx.style.setProperty('--bt-fx-delay', `${index * 110}ms`)
    element.append(fx)
    setTimeout(() => fx.remove(), 1400)
  }
}

/**
 * Brings a mark to life while `enabled`.
 * @param {{ current: HTMLElement | null }} ref the mark's element
 * @param {boolean} enabled
 * @param {string} state the mark's state
 * @returns {() => void} what a click on the mark calls
 */
export function useMarkLife(ref, enabled, state) {
  const stateRef = useRef(state)
  stateRef.current = state
  const life = useRef(null)
  useEffect(() => {
    const element = ref.current
    if (!enabled || !element) return undefined
    let clearing = 0
    let frame = 0
    let timer = 0
    let lastActive = performance.now()
    let point = null
    let stroke = { distance: 0, since: 0, x: 0, y: 0 }
    let pokes = { count: 0, at: 0 }
    const wake = () => {
      lastActive = performance.now()
      if (element.dataset.rest === undefined) return false
      delete element.dataset.rest
      return true
    }
    const play = (reaction) => {
      if (!motionAllowed()) return
      clearTimeout(clearing)
      // A new name restarts nothing when it is the same one, so it is taken off first.
      delete element.dataset.react
      void element.offsetWidth
      element.dataset.react = reaction
      if (SPARKS[reaction]) spark(element, SPARKS[reaction])
      clearing = setTimeout(() => { delete element.dataset.react }, REACTION_MS[reaction])
    }
    const lean = () => {
      frame = 0
      const leaning = motionAllowed() ? leanOf(element.getBoundingClientRect(), point) : null
      element.style.setProperty('--bt-look-x', `${(leaning?.x ?? 0).toFixed(2)}%`)
      element.style.setProperty('--bt-look-y', `${(leaning?.y ?? 0).toFixed(2)}%`)
      element.style.setProperty('--bt-look-tilt', `${(leaning?.tilt ?? 0).toFixed(2)}deg`)
      if (leaning && wake()) play('wake')
    }
    const onMove = (event) => {
      point = { x: event.clientX, y: event.clientY }
      frame ||= requestAnimationFrame(lean)
      const box = element.getBoundingClientRect()
      const inside = point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom
      if (!inside) { stroke = { distance: 0, since: 0, x: 0, y: 0 }; return }
      const now = performance.now()
      if (stroke.since === 0 || now - stroke.since > STROKE_WINDOW_MS) stroke = { distance: 0, since: now, x: point.x, y: point.y }
      stroke.distance += Math.hypot(point.x - stroke.x, point.y - stroke.y)
      stroke.x = point.x
      stroke.y = point.y
      // A stroke that goes on waits for the hearts it already raised.
      if (stroke.distance >= STROKE_DISTANCE && element.dataset.react !== 'love') {
        stroke = { distance: 0, since: 0, x: 0, y: 0 }
        play('love')
      }
    }
    const onLeave = () => {
      point = null
      frame ||= requestAnimationFrame(lean)
    }
    const shown = () => {
      if (document.hidden) return false
      const box = element.getBoundingClientRect()
      return box.bottom > 0 && box.top < window.innerHeight && box.width > 0
    }
    const rest = () => {
      if (stateRef.current !== 'idle') lastActive = performance.now()
      else if (shown() && performance.now() - lastActive >= SLEEPY_MS) element.dataset.rest = 'sleepy'
    }
    timer = setInterval(rest, REST_CHECK_MS)
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    life.current = {
      wake,
      play,
      poke() {
        const now = performance.now()
        const count = now - pokes.at <= POKE_WINDOW_MS ? pokes.count + 1 : 1
        pokes = { count: count > POKES.length ? 0 : count, at: now }
        wake()
        play(pokeReaction(count))
      },
      spark: glyph => { if (motionAllowed()) spark(element, glyph) },
    }
    return () => {
      life.current = null
      clearTimeout(clearing)
      clearInterval(timer)
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      delete element.dataset.react
      delete element.dataset.rest
    }
  }, [enabled, ref])
  const previous = useRef(state)
  useEffect(() => {
    const was = previous.current
    previous.current = state
    if (state === was) return
    life.current?.wake()
    const reaction = stateReaction(was, state)
    if (reaction) life.current?.play(reaction)
    if (state === 'done') life.current?.spark(SPARKS.done)
  }, [state])
  return useCallback(() => { life.current?.poke() }, [])
}
