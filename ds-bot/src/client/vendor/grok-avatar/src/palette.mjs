export const PALETTE = Object.freeze({
  black: color('#000000', '#000000', '#FFFFFF'),
  brown: color('#936439', '#A27952', '#855C36'),
  red: color('#FF263C', '#FF3E51', '#E02135'),
  orange: color('#FF6700', '#FF781C', '#FF6700'),
  yellow: color('#FF9800', '#FFAF38', '#FF9800'),
  green: color('#00C972', '#00C972', '#009957'),
  cyan: color('#00BCA6', '#1CC3B0', '#00A592'),
  blue: color('#1084FE', '#2A92FE', '#0E74E0'),
  violet: color('#9159FE', '#A97EFE', '#804EE0'),
  magenta: color('#FF309B', '#FF5EB1', '#E02A88'),
  gray: color('#777777', '#959595', '#777777'),
});

export const DEFAULT_COLORS = Object.freeze(['brown', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'violet', 'magenta', 'gray']);

function color(baseHex, lightHex, darkHex) {
  return Object.freeze({ baseHex, lightHex, darkHex });
}

export function inkFor(name, theme = 'light') {
  const entry = PALETTE[name];
  if (!entry) throw new Error('AVATAR_COLOR_UNKNOWN');
  return theme === 'dark' ? entry.darkHex : entry.lightHex;
}
