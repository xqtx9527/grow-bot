import { toBody } from './catalog.mjs';
import { eyeSeat } from './eyes.mjs';
import { CANVAS, bodyPath, outlineSamples } from './geometry.mjs';
import { poseAt } from './motion.mjs';
import { appearanceOf } from './resolve.mjs';

const VIEW = 60;
const BADGE = Object.freeze({
  disc: 16,
  cutoutExtra: 2.7,
  color: '#f59312',
  star: '#ffffff',
  hairline: '#1c1c1c',
});

let serial = 0;

export function renderAvatarSvg(options = {}) {
  const look = appearanceOf(options);
  const size = options.size ?? 120;
  const id = options.id ?? `ga${(serial = (serial + 1) % 1000000)}`;
  if (look.picture?.url && options.forceCharacter !== true) {
    return pictureMarkup(look.picture.url, size, id, Boolean(options.main));
  }
  const compact = options.compact ?? size < 48;
  const pose = options.pose ?? (options.reducedMotion
    ? poseAt(options.state ?? 'idle', 0, { compact })
    : poseAt(options.state ?? 'idle', options.time ?? 0, { compact }));
  const placed = placeSamples(outlineSamples(look.shape), pose);
  const eyes = eyeMarkup(toBody(look.shape), placed.box, pose);
  const badge = options.main ? badgeMarkup(id) : { defs: '', mark: '' };
  const mask = options.main ? ` mask="url(#${id}-notch)"` : '';
  const ink = options.ink ?? look.ink ?? '#111111';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${VIEW} ${VIEW}" role="img" aria-hidden="true">${badge.defs}<g${mask}><path d="${bodyPath(look.shape)}" fill="${escapeAttr(ink)}" transform="${placed.transform}"/>${eyes}</g>${badge.mark}</svg>`;
}

function placeSamples(points, pose) {
  const bounds = box(points);
  const span = Math.max(bounds.width, bounds.height) || 1;
  const fit = 50 / span;
  const yaw = Math.max(0.72, Math.abs(Math.cos((pose.yaw * Math.PI) / 180)));
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const scaleX = fit * pose.scale * pose.squashX * yaw;
  const scaleY = fit * pose.scale * pose.squashY;
  const originX = VIEW / 2 + pose.x * 8;
  const originY = VIEW / 2 + pose.y * 8;
  const turn = (pose.turn * Math.PI) / 180;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const placed = points.map(([x, y]) => {
    const px = (x - cx) * scaleX;
    const py = (y - cy) * scaleY;
    return [originX + px * cos - py * sin, originY + px * sin + py * cos];
  });
  const transform = `translate(${fmt(originX)} ${fmt(originY)}) rotate(${fmt(pose.turn)}) scale(${fmt(scaleX)} ${fmt(scaleY)}) translate(${fmt(-cx)} ${fmt(-cy)})`;
  return { box: box(placed), transform };
}

function eyeMarkup(body, bounds, pose) {
  const seat = eyeSeat(body);
  const span = Math.max(bounds.width, bounds.height);
  const width = Math.max(0.7, seat.width * span * pose.eyeScaleX * seat.squashX);
  const height = Math.max(0.45, seat.height * span * pose.eyeScaleY);
  const gap = seat.gap * span;
  const cy = (bounds.minY + bounds.maxY) / 2 - seat.shiftY * span;
  const mid = (bounds.minX + bounds.maxX) / 2 + pose.look * span * 0.08;
  return [-1, 1].map((side) => {
    const cx = mid + side * gap * 0.5;
    const tilt = pose.tilt * side;
    const highlight = height > 1.4
      ? `<ellipse cx="${fmt(cx - width * 0.12)}" cy="${fmt(cy - height * 0.22)}" rx="${fmt(width * 0.16)}" ry="${fmt(Math.min(height * 0.14, width * 0.2))}" fill="#fff" opacity="0.92"/>`
      : '';
    return `<g transform="rotate(${fmt(tilt)} ${fmt(cx)} ${fmt(cy)})"><rect x="${fmt(cx - width / 2)}" y="${fmt(cy - height / 2)}" width="${fmt(width)}" height="${fmt(height)}" rx="${fmt(Math.min(width, height) / 2)}" fill="#fff"/>${highlight}</g>`;
  }).join('');
}

function pictureMarkup(url, size, id, main) {
  const badge = main ? badgeMarkup(id) : { defs: '', mark: '' };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${VIEW} ${VIEW}" role="img" aria-hidden="true"><defs><clipPath id="${id}-photo"><rect width="${VIEW}" height="${VIEW}" rx="8"/></clipPath>${badge.defs}</defs><image href="${escapeAttr(url)}" width="${VIEW}" height="${VIEW}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}-photo)"/>${badge.mark}</svg>`;
}

function badgeMarkup(id) {
  const radius = BADGE.disc / 2;
  const cx = VIEW - radius;
  const cy = VIEW - radius;
  const hole = radius + BADGE.cutoutExtra;
  const star = starPoints(cx, cy, radius * 0.62, radius * 0.26);
  return {
    defs: `<defs><mask id="${id}-notch"><rect width="${VIEW}" height="${VIEW}" fill="#fff"/><circle cx="${cx}" cy="${cy}" r="${fmt(hole)}" fill="#000"/></mask></defs>`,
    mark: `<circle cx="${cx}" cy="${cy}" r="${fmt(radius)}" fill="${BADGE.color}" stroke="${BADGE.hairline}" stroke-width="0.6"/><polygon points="${star}" fill="${BADGE.star}"/>`,
  };
}

function starPoints(cx, cy, outer, inner) {
  const points = [];
  for (let index = 0; index < 10; index++) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    points.push(`${fmt(cx + Math.cos(angle) * radius)},${fmt(cy + Math.sin(angle) * radius)}`);
  }
  return points.join(' ');
}

function box(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function fmt(value) {
  return String(Math.round(value * 100) / 100);
}

function escapeAttr(value) {
  return String(value).replace(/[&"]/g, (char) => (char === '&' ? '&amp;' : '&quot;'));
}

export const BADGE_SPEC = BADGE;
export const VIEWBOX = VIEW;
export { CANVAS };
