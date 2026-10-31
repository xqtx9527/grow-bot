import { renderAvatarSvg } from './render.mjs';

let serial = 0;

export function createAvatar(element, options = {}) {
  if (!element || typeof element.innerHTML !== 'string' || typeof requestAnimationFrame !== 'function') {
    throw new Error('AVATAR_DOM_REQUIRED');
  }
  const state = { ...options, id: options.id ?? `ga-live-${(serial = (serial + 1) % 1000000)}` };
  let stopped = false;
  let origin = clock();
  const frame = (time) => {
    if (stopped) return;
    element.innerHTML = renderAvatarSvg({ ...state, time: (time - origin) / 1000 });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return {
    setState(name) {
      state.state = name;
      origin = clock();
    },
    update(next) {
      Object.assign(state, next);
    },
    destroy() {
      stopped = true;
    },
  };
}

function clock() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
