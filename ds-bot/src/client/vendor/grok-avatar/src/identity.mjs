// Agent-id avatar parameters for the Grok Bot 0.70.2 desktop client.
// Independent integer implementation. It does not load the official renderer.

export const AVATAR_ALGORITHM_VERSION = 'grok-bot-0.70.2';

const IDENTITY_SALT_VERSION = 1;
const PALETTE_SALT_VERSION = 1;
const GOLDEN = 2654435769;

export function hashBotId(key) {
  if (typeof key !== 'string' || key.length === 0) throw new Error('AVATAR_KEY_REQUIRED');
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return hash >>> 0;
}

export function deriveDefaultAvatar(key) {
  const hash = hashBotId(key);
  let shapeHash = hash | 0;
  shapeHash = Math.imul(shapeHash ^ (shapeHash >>> 16), 73244475);
  shapeHash = Math.imul(shapeHash ^ (shapeHash >>> 13), 3266489909);
  shapeHash = (shapeHash ^ (shapeHash >>> 16)) >>> 0;
  const identitySeed = (hash ^ Math.imul(IDENTITY_SALT_VERSION, GOLDEN)) >>> 0;
  let seed = (identitySeed ^ Math.imul(PALETTE_SALT_VERSION, GOLDEN)) >>> 0;
  seed = (seed + 1831565813) | 0;
  let sample = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  sample = (sample + Math.imul(sample ^ (sample >>> 7), 61 | sample)) ^ sample;
  const random = ((sample ^ (sample >>> 14)) >>> 0) / 4294967296;
  return { hash, shapeHash, random };
}
