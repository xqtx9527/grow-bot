export const DEFAULT_SHAPES = Object.freeze(['blob', 'pebble', 'squircle', 'tablet', 'wedge', 'hex', 'cloud', 'teardrop']);

export const SHAPES = Object.freeze([
  'blob', 'pebble', 'bean', 'egg', 'squircle', 'tablet', 'capsule', 'cylinder', 'hex', 'gem', 'crystal',
  'wedge', 'shield', 'dome', 'arch', 'cloud', 'teardrop', 'leaf', 'square', 'sparkle', 'clover',
  'flower', 'heart', 'house', 'star',
]);

export const BODIES = Object.freeze([
  'sphere', 'cloud', 'square', 'sparkle', 'clover', 'heartChubby', 'starFlower', 'teardrop', 'tablet',
  'wedge', 'house', 'star6', 'pebble', 'bean', 'egg', 'squircle', 'capsule', 'cylinder', 'hex', 'gem',
  'crystal', 'shield', 'dome', 'arch', 'leaf',
]);

const WORKING = Object.freeze({
  clips: ['Working_A', 'Working_B', 'Working_C', 'Working_D', 'Working_E', 'Working_F'],
});

export const STATES = Object.freeze({
  idle: { clips: ['Idle_B', 'Idle_B', 'Idle_D', 'Idle_B', 'Idle_A'], compactClips: ['Idle_B'] },
  listening: { clips: ['Idle_D'], face: 'calm' },
  thinking: { clips: ['Idle_B'], morph: 'thinking' },
  streaming: { clips: ['Streaming_A', 'Streaming_B', 'Streaming_C'] },
  searching: { clips: ['Idle_B'], morph: 'radar' },
  reading: WORKING,
  working: WORKING,
  coding: WORKING,
  running: WORKING,
  computing: WORKING,
  controlling: WORKING,
  waiting: { clips: ['Idle_B'], morph: 'orbit' },
  blocked: { clips: ['Blocked_A'], next: 'drowsy', holdSeconds: 120 },
  finished: { clips: ['Done_B', 'Done_A'], face: 'happy', next: 'idle' },
  failed: { clips: ['Blocked_B'], next: 'idle' },
  sleeping: { clips: ['Idle_B'], face: 'sleepy' },
  waking: { clips: ['Idle_B'], face: 'surprised', next: 'idle', holdSeconds: 1.6 },
  happy: { clips: ['Done_A'] },
  excited: { clips: ['Done_C'] },
  laughing: { clips: ['Done_B'] },
  proud: { clips: ['Marketing_B'] },
  curious: { clips: ['Working_B'], face: 'inspecting' },
  playful: { clips: ['Bodymoves_A'] },
  shy: { clips: ['Idle_D'], face: 'calm' },
  surprised: { clips: ['Idle_B'], face: 'surprised' },
  suspicious: { clips: ['Idle_D'], face: 'squinted' },
  angry: { clips: ['Blocked_A'], face: 'squinted' },
  confused: { clips: ['Blocked_A'] },
  sad: { clips: ['Blocked_B'] },
  drowsy: { clips: ['Blocked_C'] },
  bored: { clips: ['Idle_B'], face: 'sleepy' },
  scared: { clips: ['Idle_D'], face: 'surprised' },
  celebrate: { clips: ['Rotation_A'], face: 'happy' },
  approving: { clips: ['Rotation_C'], next: 'idle' },
  orbit: { clips: ['Idle_B'], morph: 'orbit' },
  radar: { clips: ['Idle_B'], morph: 'radar' },
  progress: { clips: ['Idle_B'], morph: 'progress' },
  spawning: { clips: ['Idle_B'], morph: 'spawning' },
  loading: { clips: ['Idle_B'], morph: 'progress' },
  dictating: { clips: ['Idle_B'], morph: 'dictating' },
  sending: { clips: ['Idle_B'], morph: 'sending' },
  receiving: { clips: ['Idle_B'], morph: 'receiving' },
  uploading: { clips: ['Idle_B'], morph: 'uploading' },
  writing: { clips: ['Idle_B'], morph: 'writing' },
  alerting: { clips: ['Idle_B'], morph: 'alerting' },
  bouncing: { clips: ['Idle_B'], morph: 'bouncing' },
  'powering-down': { clips: ['Idle_B'], morph: 'powering-down' },
  humming: { clips: ['Idle_B'], face: 'calm' },
  notifying: { clips: ['Done_B'], face: 'surprised' },
  dragging: { clips: ['Idle_B'], face: 'surprised' },
  logo: { clips: ['Logo_A', 'Logo_B'] },
  showcase: { clips: ['Marketing_A', 'Marketing_B', 'Marketing_C', 'Marketing_D'] },
  turntable: { clips: ['Rotation_B'] },
});

export const FACES = Object.freeze(['neutral', 'happy', 'surprised', 'sad', 'sleepy', 'squinted', 'calm', 'inspecting', 'confused']);

export function toBody(shape) {
  switch (shape) {
    case 'blob': return 'sphere';
    case 'flower': return 'starFlower';
    case 'heart': return 'heartChubby';
    case 'star': return 'star6';
    default: return shape;
  }
}
