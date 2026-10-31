import clips from '../data/clips.json' with { type: 'json' };
import { STATES } from './catalog.mjs';

const BY_NAME = new Map(clips.map((clip) => [clip.name, clip]));

const FACE_STYLE = {
  neutral: { scaleX: 1, scaleY: 1, tilt: 8, look: 0 },
  happy: { scaleX: 1.04, scaleY: 0.7, tilt: 16, look: 0 },
  surprised: { scaleX: 0.82, scaleY: 1.18, tilt: 4, look: 0 },
  sad: { scaleX: 1, scaleY: 0.78, tilt: -12, look: 0 },
  sleepy: { scaleX: 1.08, scaleY: 0.32, tilt: 6, look: 0 },
  squinted: { scaleX: 1.12, scaleY: 0.42, tilt: 10, look: 0 },
  calm: { scaleX: 0.92, scaleY: 0.84, tilt: 6, look: 0 },
  inspecting: { scaleX: 0.9, scaleY: 1, tilt: 12, look: 0.35 },
  confused: { scaleX: 0.96, scaleY: 0.9, tilt: -8, look: -0.15 },
  strange: { scaleX: 1.05, scaleY: 0.85, tilt: -6, look: 0.2 },
};

export function poseAt(state, time, { compact = false } = {}) {
  const spec = STATES[state] ?? STATES.idle;
  const sequence = resolveSequence(spec, Math.max(0, time), compact);
  const clip = BY_NAME.get(sequence.clip);
  if (!clip) return restPose(spec.face);
  const sample = sampleClip(clip, sequence.local);
  const faceName = spec.face ?? faceFromExpression(sample.expression) ?? 'neutral';
  const face = FACE_STYLE[faceName] ?? FACE_STYLE.neutral;
  const blink = Math.max(blinkPulse(clip.tracks?.expression, sequence.local), sample.lids);
  return {
    state,
    clip: clip.name,
    face: faceName,
    morph: spec.morph ?? null,
    x: sample.position[0],
    y: sample.position[1],
    turn: sample.rotation[2] || 0,
    yaw: sample.rotation[1] || 0,
    scale: (sample.scale[0] || 0.6) / 0.6,
    squashX: sample.squash[0] || 1,
    squashY: sample.squash[1] || 1,
    blink,
    look: face.look + (sample.position[0] || 0),
    eyeScaleX: face.scaleX,
    eyeScaleY: face.scaleY * (1 - 0.88 * Math.min(1, blink)),
    tilt: face.tilt,
  };
}

function resolveSequence(spec, time, compact) {
  const names = compact && spec.compactClips ? spec.compactClips : spec.clips;
  if (spec.holdSeconds != null && spec.next && time >= spec.holdSeconds) {
    return resolveSequence(STATES[spec.next] ?? { clips: names }, time - spec.holdSeconds, compact);
  }
  let remain = time;
  let index = 0;
  for (let guard = 0; guard < 10000; guard++) {
    const name = names[index % names.length];
    const clip = BY_NAME.get(name);
    const duration = clip?.duration ?? 1;
    if (remain < duration) return { clip: name, local: remain };
    remain -= duration;
    index += 1;
  }
  return { clip: names[0], local: 0 };
}

function restPose(face) {
  const style = FACE_STYLE[face ?? 'neutral'] ?? FACE_STYLE.neutral;
  return {
    clip: 'Idle_B', face: face ?? 'neutral', morph: null, x: 0, y: 0, turn: 0, yaw: 0,
    scale: 1, squashX: 1, squashY: 1, blink: 0, look: style.look,
    eyeScaleX: style.scaleX, eyeScaleY: style.scaleY, tilt: style.tilt,
  };
}

function sampleClip(clip, time) {
  const tracks = clip.tracks ?? {};
  return {
    position: vectorAt(tracks.position, time, [0, 0]),
    rotation: vectorAt(tracks.rotation, time, [0, 0, 0]),
    scale: vectorAt(tracks.scale, time, [0.6]),
    squash: vectorAt(tracks.squash, time, [1, 1]),
    lids: numberAt(tracks.lids, time, 0),
    expression: labelAt(tracks.expression, time),
  };
}

function vectorAt(keys, time, fallback) {
  if (!keys?.length) return fallback;
  const [prev, next, amount] = segment(keys, time);
  if (!next) return prev.v;
  return prev.v.map((value, index) => value + (next.v[index] - value) * amount);
}

function numberAt(keys, time, fallback) {
  if (!keys?.length) return fallback;
  const [prev, next, amount] = segment(keys, time);
  if (!next) return prev.v[0];
  return prev.v[0] + (next.v[0] - prev.v[0]) * amount;
}

function labelAt(keys, time) {
  if (!keys?.length) return null;
  let current = null;
  for (const key of keys) {
    if (key.t > time) break;
    current = key.v;
  }
  return current;
}

function faceFromExpression(name) {
  if (name === 'inspect') return 'inspecting';
  return typeof name === 'string' && FACE_STYLE[name] ? name : null;
}

function blinkPulse(keys, time) {
  if (!keys?.length) return 0;
  let amount = 0;
  for (const key of keys) {
    if (key.v !== 'blink') continue;
    const distance = Math.abs(time - key.t);
    if (distance < 0.16) amount = Math.max(amount, 1 - distance / 0.16);
  }
  return amount;
}

function segment(keys, time) {
  if (time <= keys[0].t) return [keys[0], null, 0];
  for (let i = 1; i < keys.length; i++) {
    if (time <= keys[i].t) {
      const prev = keys[i - 1];
      const next = keys[i];
      const span = next.t - prev.t || 1;
      return [prev, next, bezierY((time - prev.t) / span, next.ease)];
    }
  }
  return [keys.at(-1), null, 0];
}

function bezierY(amount, ease) {
  if (!ease) return amount;
  const [x1, y1, x2, y2] = ease;
  let t = amount;
  for (let i = 0; i < 6; i++) {
    const x = cubic(t, x1, x2) - amount;
    const slope = cubicSlope(t, x1, x2);
    if (Math.abs(slope) < 1e-4) break;
    t = Math.min(1, Math.max(0, t - x / slope));
  }
  return cubic(t, y1, y2);
}

function cubic(t, a, b) {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
}

function cubicSlope(t, a, b) {
  const u = 1 - t;
  return 3 * u * u * a + 6 * u * t * (b - a) + 3 * t * t * (1 - b);
}

export const CLIP_NAMES = Object.freeze(clips.map((clip) => clip.name));
