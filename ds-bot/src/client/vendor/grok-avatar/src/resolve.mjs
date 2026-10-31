import { AVATAR_ALGORITHM_VERSION, deriveDefaultAvatar } from './identity.mjs';
import { DEFAULT_COLORS, PALETTE, inkFor } from './palette.mjs';
import { DEFAULT_SHAPES, SHAPES } from './catalog.mjs';

export function resolveAvatar(input) {
  const agentId = typeof input === 'string' ? input : input?.agentId;
  if (typeof agentId !== 'string' || agentId.length === 0) throw new Error('AVATAR_AGENT_ID_REQUIRED');
  const derived = deriveDefaultAvatar(agentId);
  const shapeIndex = derived.shapeHash % DEFAULT_SHAPES.length;
  const colorIndex = Math.floor(derived.random * DEFAULT_COLORS.length);
  const explicitShape = SHAPES.includes(input?.avatarShape) ? input.avatarShape : null;
  const explicitColor = typeof input?.avatarColor === 'string' && Object.hasOwn(PALETTE, input.avatarColor) ? input.avatarColor : null;
  const shape = explicitShape ?? DEFAULT_SHAPES[shapeIndex];
  const color = explicitColor ?? DEFAULT_COLORS[colorIndex];
  const picture = pictureOf(input);
  return {
    algorithmVersion: AVATAR_ALGORITHM_VERSION,
    agentId,
    kind: picture ? 'picture' : 'character',
    shape,
    color,
    ...PALETTE[color],
    sources: {
      shape: explicitShape ? 'explicit' : 'id-default',
      color: explicitColor ? 'explicit' : 'id-default',
    },
    picture,
    hash: derived.hash,
    shapeHash: derived.shapeHash,
    shapeIndex,
    colorIndex,
  };
}

export function appearanceOf(options) {
  if (typeof options === 'string' || options?.agentId) {
    const resolved = resolveAvatar(options.agentId ? options : options);
    return {
      ...resolved,
      shape: options.shape ?? resolved.shape,
      color: options.color ?? resolved.color,
      ink: options.ink ?? inkFor(options.color ?? resolved.color, options.theme),
    };
  }
  const shape = options.shape ?? 'blob';
  const color = options.color ?? 'blue';
  return {
    kind: 'character',
    shape,
    color,
    ...PALETTE[color],
    ink: options.ink ?? inkFor(color, options.theme),
    picture: null,
  };
}

function pictureOf(input) {
  if (!input || typeof input === 'string') return null;
  const url = nonempty(input.avatarUrl) ? input.avatarUrl : nonempty(input.avatarDataUrl) ? input.avatarDataUrl : null;
  const version = nonempty(input.avatarVersion) ? input.avatarVersion : null;
  return url || version ? { url, version } : null;
}

function nonempty(value) {
  return typeof value === 'string' && value.length > 0;
}
