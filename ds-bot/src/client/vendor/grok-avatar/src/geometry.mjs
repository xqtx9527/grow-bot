// 2D outlines for the Grok Bot 0.70.2 character set.
// Rounded polygons, superellipses, circle unions, and bezier arcs are fitted
// into a 228.44 box centered at 114.2705. The desktop client revolves, lofts,
// or extrudes these same outlines. This module keeps the front-view path.

import vectors from '../data/vectors.json' with { type: 'json' };
import { toBody } from './catalog.mjs';

export const CANVAS = Object.freeze({ center: 114.2705, target: 228.44 });

const CENTER = CANVAS.center;
const TARGET = CANVAS.target;
const TAU = Math.PI * 2;

const round = (value) => Math.round(value * 100) / 100;
const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);

class Outline {
  d = '';

  move(x, y) {
    this.d += `M${round(x)} ${round(y)}`;
    return this;
  }

  line(x, y) {
    this.d += `L${round(x)} ${round(y)}`;
    return this;
  }

  curve(x1, y1, x2, y2, x, y) {
    this.d += `C${round(x1)} ${round(y1)} ${round(x2)} ${round(y2)} ${round(x)} ${round(y)}`;
    return this;
  }

  corner(prev, point, next, radius) {
    const unit = (from, to) => {
      const dx = from[0] - to[0];
      const dy = from[1] - to[1];
      const length = Math.hypot(dx, dy) || 1;
      return [dx / length, dy / length];
    };
    const incoming = unit(prev, point);
    const outgoing = unit(next, point);
    const start = [point[0] + incoming[0] * radius, point[1] + incoming[1] * radius];
    const end = [point[0] + outgoing[0] * radius, point[1] + outgoing[1] * radius];
    if (this.d) this.line(start[0], start[1]);
    else this.move(start[0], start[1]);
    this.d += `Q${round(point[0])} ${round(point[1])} ${round(end[0])} ${round(end[1])}`;
    return this;
  }

  arc(cx, cy, rx, ry, start, end) {
    const pieces = Math.max(1, Math.ceil(Math.abs(end - start) / (Math.PI / 2)));
    const sweep = (end - start) / pieces;
    const control = (4 / 3) * Math.tan(sweep / 4);
    let angle = start;
    for (let index = 0; index < pieces; index++) {
      const next = angle + sweep;
      const x0 = cx + rx * Math.cos(angle);
      const y0 = cy + ry * Math.sin(angle);
      const x1 = cx + rx * Math.cos(next);
      const y1 = cy + ry * Math.sin(next);
      this.curve(
        x0 - control * rx * Math.sin(angle),
        y0 + control * ry * Math.cos(angle),
        x1 + control * rx * Math.sin(next),
        y1 - control * ry * Math.cos(next),
        x1,
        y1,
      );
      angle = next;
    }
    return this;
  }

  close() {
    return `${this.d}Z`;
  }
}

function smoothClosed(points) {
  const count = points.length;
  let path = `M${round(points[0][0])} ${round(points[0][1])}`;
  for (let index = 0; index < count; index++) {
    const prev = points[(index - 1 + count) % count];
    const current = points[index];
    const next = points[(index + 1) % count];
    const after = points[(index + 2) % count];
    path += `C${round(current[0] + (next[0] - prev[0]) / 6)} ${round(current[1] + (next[1] - prev[1]) / 6)} ${round(next[0] - (after[0] - current[0]) / 6)} ${round(next[1] - (after[1] - current[1]) / 6)} ${round(next[0])} ${round(next[1])}`;
  }
  return `${path}Z`;
}

function samplePolar(sample, count = 128) {
  const points = [];
  for (let index = 0; index < count; index++) points.push(sample((index / count) * TAU));
  return smoothClosed(points);
}

function circleUnion(circles, count = 160) {
  return samplePolar((angle) => {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let reach = 0;
    for (const [cx, cy, radius] of circles) {
      const ux = cx - CENTER;
      const uy = cy - CENTER;
      const along = dx * ux + dy * uy;
      const discriminant = along * along - (ux * ux + uy * uy) + radius * radius;
      if (discriminant <= 0) continue;
      reach = Math.max(reach, along + Math.sqrt(discriminant));
    }
    return [CENTER + dx * reach, CENTER + dy * reach];
  }, count);
}

function superellipse(rx, ry, n) {
  return samplePolar((angle) => {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return [
      CENTER + Math.sign(cosine) * Math.abs(cosine) ** (2 / n) * rx,
      CENTER + Math.sign(sine) * Math.abs(sine) ** (2 / n) * ry,
    ];
  });
}

function roundPolygon(vertices, radius) {
  const path = new Outline();
  const count = vertices.length;
  for (let index = 0; index < count; index++) {
    const corner = typeof radius === 'number' ? radius : radius[index % radius.length];
    path.corner(vertices[(index - 1 + count) % count], vertices[index], vertices[(index + 1) % count], corner);
  }
  return path.close();
}

function regular(radius, sides, corner, rotation = 0) {
  const vertices = Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (index / sides) * TAU;
    return [CENTER + Math.cos(angle) * radius, CENTER + Math.sin(angle) * radius];
  });
  return roundPolygon(vertices, corner);
}

function starFlower() {
  const circles = [{ x: 0, y: 0, r: 0.36 }];
  for (let index = 0; index < 6; index++) {
    const angle = -Math.PI / 2 + (index * TAU) / 6;
    circles.push({ x: 0.58 * Math.cos(angle), y: 0.58 * Math.sin(angle), r: 0.33 });
  }
  const points = [];
  const count = 240;
  for (let index = 0; index < count; index++) {
    const angle = (index / count) * TAU;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let low = 0;
    let high = 0.58 + 0.33;
    for (let step = 0; step < 22; step++) {
      const mid = (low + high) / 2;
      const x = mid * dx;
      const y = mid * dy;
      const inside = circles.some((circle) => (x - circle.x) ** 2 + (y - circle.y) ** 2 <= circle.r ** 2);
      if (inside) low = mid;
      else high = mid;
    }
    points.push([CENTER + low * dx * CENTER, CENTER + low * dy * CENTER]);
  }
  return smoothClosed(points);
}

function crystal() {
  // Fourteen non-overlapping balls. A polar union from the canvas center
  // pinches to nothing on the rays that miss a ball, so each disc is its own subpath.
  const circles = [];
  const add = (x, y) => circles.push([CENTER + x * CENTER, CENTER - y * CENTER, 0.12 * CENTER]);
  const height = 1.16;
  add(0, height - 0.12);
  add(0, -(height - 0.12));
  const band = 0.54 - 0.12 * 0.25;
  const reach = 0.64 - 0.12;
  for (const side of [-1, 1]) {
    for (let index = 0; index < 6; index++) {
      const angle = (index / 6) * TAU;
      add(reach * Math.cos(angle), side * band);
    }
  }
  return circles.map(([cx, cy, radius]) => new Outline()
    .move(cx + radius, cy)
    .arc(cx, cy, radius, radius, 0, TAU)
    .close()).join('');
}

const BUILDERS = {
  sphere: () => new Outline().move(CENTER + 108, CENTER).arc(CENTER, CENTER, 108, 108, 0, TAU).close(),
  pebble: () => samplePolar((angle) => {
    const radius = 108 * (1 + 0.075 * (Math.sin(angle * 2 + 1.1) * 0.6 + Math.sin(angle * 3 - 1.1) * 0.4));
    return [CENTER + Math.cos(angle) * radius, CENTER + Math.sin(angle) * radius * 0.98];
  }),
  bean: () => samplePolar((angle) => {
    const lobe = (shift) => {
      const delta = Math.abs(((angle - shift + Math.PI) % TAU + TAU) % TAU - Math.PI);
      return Math.exp(-(delta * delta) / 0.4232);
    };
    const pinch = 1 - 0.34 * lobe(Math.PI) + 0.34 * 0.34 * lobe(0);
    return [CENTER + Math.cos(angle) * 94 * pinch, CENTER + Math.sin(angle) * 112 * pinch];
  }),
  egg: () => samplePolar((angle) => {
    const sine = Math.sin(angle);
    const pinch = (1 - sine) / 2;
    return [CENTER + Math.cos(angle) * 98 * (1 - 0.22 * pinch * pinch), CENTER + sine * 113];
  }),
  squircle: () => superellipse(107, 107, 3.2),
  square: () => roundPolygon([
    [CENTER - 107, CENTER - 107],
    [CENTER + 107, CENTER - 107],
    [CENTER + 107, CENTER + 107],
    [CENTER - 107, CENTER + 107],
  ], 28),
  tablet: () => new Outline()
    .move(CENTER - 114 + 74, CENTER - 74)
    .line(CENTER + 114 - 74, CENTER - 74)
    .arc(CENTER + 114 - 74, CENTER, 74, 74, -Math.PI / 2, Math.PI / 2)
    .line(CENTER - 114 + 74, CENTER + 74)
    .arc(CENTER - 114 + 74, CENTER, 74, 74, Math.PI / 2, Math.PI * 1.5)
    .close(),
  capsule: () => new Outline()
    .move(CENTER - 72, CENTER + 113 - 72)
    .line(CENTER - 72, CENTER - 113 + 72)
    .arc(CENTER, CENTER - 113 + 72, 72, 72, Math.PI, TAU)
    .line(CENTER + 72, CENTER + 113 - 72)
    .arc(CENTER, CENTER + 113 - 72, 72, 72, 0, Math.PI)
    .close(),
  cylinder: () => new Outline()
    .move(CENTER - 94, CENTER - 110 + 48)
    .arc(CENTER, CENTER - 110 + 48, 94, 48, Math.PI, TAU)
    .line(CENTER + 94, CENTER + 110 - 48)
    .arc(CENTER, CENTER + 110 - 48, 94, 48, 0, Math.PI)
    .close(),
  hex: () => regular(114, 6, 20, Math.PI / 6),
  gem: () => superellipse(112, 113, 1.5),
  crystal,
  wedge: () => regular(130, 3, [80, 60, 60], -Math.PI / 2),
  shield: () => {
    const halfWidth = 98;
    const halfHeight = 108;
    const neck = 30;
    const top = CENTER - halfHeight;
    const bottom = CENTER + halfHeight;
    return new Outline()
      .move(CENTER - halfWidth, top + neck)
      .curve(CENTER - halfWidth, top - 2, CENTER - halfWidth * 0.5, top - 10, CENTER, top - 10)
      .curve(CENTER + halfWidth * 0.5, top - 10, CENTER + halfWidth, top - 2, CENTER + halfWidth, top + neck)
      .curve(CENTER + halfWidth, CENTER + halfHeight * 0.42, CENTER + halfWidth * 0.62, bottom, CENTER, bottom)
      .curve(CENTER - halfWidth * 0.62, bottom, CENTER - halfWidth, CENTER + halfHeight * 0.42, CENTER - halfWidth, top + neck)
      .close();
  },
  dome: () => {
    const halfWidth = 114;
    const rise = 82;
    const corner = 26;
    const foot = CENTER + rise;
    return new Outline()
      .move(CENTER - halfWidth, foot - corner)
      .arc(CENTER, foot - corner, halfWidth, 2 * rise - corner, Math.PI, TAU)
      .line(CENTER + halfWidth, foot - corner)
      .curve(CENTER + halfWidth, foot, CENTER + halfWidth, foot, CENTER + halfWidth - corner, foot)
      .line(CENTER - halfWidth + corner, foot)
      .curve(CENTER - halfWidth, foot, CENTER - halfWidth, foot, CENTER - halfWidth, foot - corner)
      .close();
  },
  arch: () => {
    const radius = 76;
    const halfHeight = 113;
    const corner = 42;
    const foot = CENTER + halfHeight;
    const crown = CENTER - halfHeight + radius;
    return new Outline()
      .move(CENTER - radius, crown)
      .arc(CENTER, crown, radius, radius, Math.PI, TAU)
      .line(CENTER + radius, foot - corner)
      .curve(CENTER + radius, foot, CENTER + radius, foot, CENTER + radius - corner, foot)
      .line(CENTER - radius + corner, foot)
      .curve(CENTER - radius, foot, CENTER - radius, foot, CENTER - radius, foot - corner)
      .close();
  },
  cloud: () => circleUnion([
    [CENTER - 62, CENTER + 26, 56],
    [CENTER + 62, CENTER + 26, 54],
    [CENTER, CENTER + 34, 62],
    [CENTER - 24, CENTER - 30, 62],
    [CENTER + 38, CENTER - 26, 54],
  ]),
  teardrop: () => {
    const radius = 88;
    const tip = CENTER - 114;
    const foot = CENTER + 26;
    const align = clamp(radius / (foot - tip), -1, 1);
    const sine = Math.sqrt(1 - align * align);
    const right = [CENTER + radius * sine, foot - radius * align];
    const left = [CENTER - radius * sine, foot - radius * align];
    const sweep = Math.atan2(right[1] - foot, right[0] - CENTER);
    return new Outline()
      .corner(right, [CENTER, tip], left, 48)
      .line(left[0], left[1])
      .arc(CENTER, foot, radius, radius, Math.PI - sweep, sweep)
      .close();
  },
  leaf: () => samplePolar((angle) => {
    const sine = Math.sin(angle);
    const waist = Math.max(1 - sine * sine, 0) ** (1.5 / 2 - 0.5);
    return [CENTER + Math.cos(angle) * 88 * waist, CENTER + sine * 113];
  }),
  clover: () => circleUnion([
    [CENTER - 38, CENTER - 38, 58],
    [CENTER + 38, CENTER - 38, 58],
    [CENTER + 38, CENTER + 38, 58],
    [CENTER - 38, CENTER + 38, 58],
  ]),
  house: () => roundPolygon([
    [CENTER - 100, CENTER + 110],
    [CENTER + 100, CENTER + 110],
    [CENTER + 100, CENTER - 110 + 78],
    [CENTER, CENTER - 110],
    [CENTER - 100, CENTER - 110 + 78],
  ], 29),
  starFlower,
  heartChubby: () => vectors.heart,
  sparkle: () => vectors.sparkle,
  star6: () => vectors.star6,
};

export function samplePath(path, step = 4) {
  const tokens = path.match(/[MLCQZmlcqz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const points = [];
  let index = 0;
  let command = '';
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  const take = () => Number(tokens[index++]);
  const push = (fn, length) => {
    const count = Math.max(2, Math.ceil(length / step));
    for (let stepIndex = 1; stepIndex <= count; stepIndex++) points.push(fn(stepIndex / count));
  };
  while (index < tokens.length) {
    if (/[a-z]/i.test(tokens[index])) command = tokens[index++].toUpperCase();
    if (command === 'Z') {
      if (Math.hypot(startX - x, startY - y) > 0.01) {
        push((t) => [x + (startX - x) * t, y + (startY - y) * t], Math.hypot(startX - x, startY - y));
      }
      x = startX;
      y = startY;
      continue;
    }
    if (index >= tokens.length) break;
    if (command === 'M') {
      x = take();
      y = take();
      startX = x;
      startY = y;
      points.push([x, y]);
      command = 'L';
    } else if (command === 'L') {
      const nx = take();
      const ny = take();
      push((t) => [x + (nx - x) * t, y + (ny - y) * t], Math.hypot(nx - x, ny - y));
      x = nx;
      y = ny;
    } else if (command === 'Q') {
      const cx = take();
      const cy = take();
      const nx = take();
      const ny = take();
      const x0 = x;
      const y0 = y;
      push((t) => {
        const u = 1 - t;
        return [u * u * x0 + 2 * u * t * cx + t * t * nx, u * u * y0 + 2 * u * t * cy + t * t * ny];
      }, Math.hypot(cx - x, cy - y) + Math.hypot(nx - cx, ny - cy));
      x = nx;
      y = ny;
    } else {
      const c1x = take();
      const c1y = take();
      const c2x = take();
      const c2y = take();
      const nx = take();
      const ny = take();
      const x0 = x;
      const y0 = y;
      push((t) => {
        const u = 1 - t;
        return [
          u ** 3 * x0 + 3 * u ** 2 * t * c1x + 3 * u * t ** 2 * c2x + t ** 3 * nx,
          u ** 3 * y0 + 3 * u ** 2 * t * c1y + 3 * u * t ** 2 * c2y + t ** 3 * ny,
        ];
      }, Math.hypot(c1x - x, c1y - y) + Math.hypot(c2x - c1x, c2y - c1y) + Math.hypot(nx - c2x, ny - c2y));
      x = nx;
      y = ny;
    }
  }
  return points;
}

function fitPath(path) {
  const points = samplePath(path);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const dx = CENTER - (minX + maxX) / 2;
  const dy = CENTER - (minY + maxY) / 2;
  const k = clamp(TARGET / Math.max(maxX - minX, maxY - minY), 0.9, 1.35);
  if (Math.abs(k - 1) < 0.005 && Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return path;
  let axis = 0;
  return path.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (raw) => {
    axis ^= 1;
    const shifted = Number(raw) + (axis ? dx : dy);
    return String(round(CENTER + (shifted - CENTER) * k));
  });
}

const PATHS = new Map();
const SAMPLES = new Map();

export function bodyPath(shape) {
  const body = toBody(shape);
  const cached = PATHS.get(body);
  if (cached) return cached;
  const build = BUILDERS[body];
  if (!build) throw new Error(`AVATAR_SHAPE_UNKNOWN:${shape}`);
  const fitted = fitPath(build());
  if (!Number.isFinite(samplePath(fitted)[0]?.[0])) throw new Error('AVATAR_OUTLINE_EMPTY');
  PATHS.set(body, fitted);
  return fitted;
}

export function outlineSamples(shape) {
  const body = toBody(shape);
  const cached = SAMPLES.get(body);
  if (cached) return cached;
  const points = samplePath(bodyPath(shape));
  if (points.length < 3) throw new Error('AVATAR_OUTLINE_EMPTY');
  SAMPLES.set(body, points);
  return points;
}
