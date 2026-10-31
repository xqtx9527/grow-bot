// Design fractions from the 0.70.2 eye table. Hex is the reference eye
// (0.26 by 0.57, gap 0.64). SVG capsules use EYE_UNIT for that reference
// and scale every other body by the same ratios. Positive shiftY moves the
// pair up. sphere is the stand-in used when a body has no seat of its own.
export const EYE_REFERENCE = Object.freeze({ width: 0.26, height: 0.57, gap: 0.64 });
export const EYE_UNIT = Object.freeze({ width: 0.16, height: 0.28, gap: 0.34 });

export const EYE_SEATS = Object.freeze({
  sphere: seat(0.22, 0.48, 0.44, 0.04),
  cloud: seat(0.21294, 0.46683, 0.470016, 0.07),
  square: seat(0.2553258426966292, 0.559752808988764, 0.529408, 0.12),
  sparkle: seat(0.18382, 0.40299, 0.41216, 0),
  clover: seat(0.23296, 0.51072, 0.559104, -0.02),
  heartChubby: seat(0.186576, 0.409032, 0.446208, 0.052, 0.6),
  starFlower: seat(0.19292, 0.42294, 0.382976, 0.12),
  teardrop: seat(0.207792, 0.455544, 0.452608, 0.18),
  tablet: seat(0.2132, 0.4674, 0.587776, 0.02),
  wedge: seat(0.2132, 0.4674, 0.467712, 0.18, 0.55),
  house: seat(0.2295124, 0.5031618, 0.512512, 0.18499534),
  star6: seat(0.184782, 0.44965989, 0.41913344, 0.12),
  pebble: seat(0.2392, 0.5244, 0.546304, 0.12),
  bean: seat(0.2028, 0.4446, 0.4608, 0.12),
  egg: seat(0.2392, 0.5244, 0.433664, 0.112999068),
  squircle: seat(0.2392, 0.5244, 0.5632, 0.12),
  capsule: seat(0.2106, 0.4617, 0.360448, 0.12),
  cylinder: seat(0.2392, 0.5244, 0.47872, 0.12),
  hex: seat(0.26, 0.57, 0.64, 0.12),
  gem: seat(0.2392, 0.5244, 0.501248, 0.12),
  crystal: seat(0.1612, 0.3534, 0.3712, 0.12),
  shield: seat(0.267904, 0.587328, 0.444928, 0.12),
  dome: seat(0.2132, 0.4674, 0.47872, 0.105998136),
  arch: seat(0.1924, 0.4218, 0.448, 0.16),
  leaf: seat(0.1872, 0.4104, 0.448, 0.04),
});

function seat(width, height, gap, shiftY, squashX = 1) {
  return Object.freeze({
    width: (width / EYE_REFERENCE.width) * EYE_UNIT.width,
    height: (height / EYE_REFERENCE.height) * EYE_UNIT.height,
    gap: (gap / EYE_REFERENCE.gap) * EYE_UNIT.gap,
    shiftY,
    squashX,
  });
}

export function eyeSeat(body) {
  return EYE_SEATS[body] ?? EYE_SEATS.sphere;
}
