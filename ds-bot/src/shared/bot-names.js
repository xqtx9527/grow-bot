// The cute English names a new Bot starts from. The first one not taken is used, so
// every Bot gets its own name; explicit names typed by the user still win.
export const BOT_NAMES = [
  'Mochi', 'Momo', 'Pip', 'Tofu', 'Biscuit', 'Nugget', 'Muffin', 'Coco', 'Peach', 'Bean',
  'Pudding', 'Waffle', 'Sprout', 'Clover', 'Pebble', 'Miso', 'Taro', 'Boba', 'Kiwi', 'Maple',
]

/** The first free name from the pool, else a numbered Mochi once the pool runs out. */
export function nextBotName(taken) {
  for (const name of BOT_NAMES) if (!taken.has(name.toLowerCase())) return name
  let index = 2
  while (taken.has(`mochi ${index}`)) index += 1
  return `Mochi ${index}`
}
