// Motions from blob-avatar. Keep long-running states calm between distinctive clips.
export const AVATAR_MOTIONS = Object.freeze({
  idle:      { expression: 'neutral',   cycle: [['idle', 7], ['wink', 1.6], ['idle', 7]] },
  thinking:  { expression: 'focused',   cycle: [['idle', 1.5], ['thinking', 2.6], ['idle', 2.5]] },
  searching: { expression: 'curious',   cycle: [['idle', 1.5], ['orbit', 3.4], ['idle', 2.5]] },
  working:   { expression: 'attentive', cycle: [['orbit', 3.4]] },
  sending:   { expression: 'attentive', cycle: [['idle', 1], ['notification', 2.2], ['idle', 3]] },
  orbit:     { expression: 'curious',   cycle: [['idle', 2], ['orbit', 3.4], ['idle', 3]] },
  waiting:   { expression: 'neutral',   cycle: [['idle', 6], ['snooze', 2.6], ['idle', 6]] },
  alert:     { expression: 'surprised', cycle: [['idle', 1.5], ['question', 2], ['idle', 4]] },
  done:      { expression: 'happy',     cycle: [['check', 1.8], ['idle', 2]] },
})
export const avatarMotion = state => AVATAR_MOTIONS[state] ?? AVATAR_MOTIONS.idle
export const avatarCycle = state => avatarMotion(state).cycle.map(([anim, dur]) => ({ anim, dur }))

// Reactions play over the normal idle animation, then settle back into it.
export const IDLE_REACTIONS = Object.freeze([
  { anim: 'wink', dur: 1.6 }, { anim: 'nod', dur: 1.4 },
  { anim: 'jump', dur: 1.6 }, { anim: 'wide', dur: 1.8 },
  { anim: 'play', dur: 2 }, { anim: 'love', dur: 2 },
  { anim: 'spin', dur: 1.6 }, { anim: 'snooze', dur: 2.6 },
])
export function nextIdleReaction(previous, random = Math.random) {
  const choices = IDLE_REACTIONS.filter(item => item.anim !== previous)
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]
}
export const idleDelay = (random = Math.random) => 6000 + random() * 9000
