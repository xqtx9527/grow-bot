// Builds the icon set from the logo in assets/icon.svg: assets/icon.png, the Windows app
// icon (assets/icon.ico), the menu-bar and tray marks (assets/trayTemplate.png with
// its @2x for macOS, assets/tray.png and assets/tray.ico for Linux and Windows) and
// the eyes cut out of the template, so a one-colour menu bar still shows a face.
//
// Usage: npm run icon  (needs the app's dependencies; uses sharp, no Electron).
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets')
const source = join(assets, 'icon.png')
await sharp(join(assets, 'icon.svg'), { density: 300 }).resize(1024, 1024).png({ compressionLevel: 9 }).toFile(source)
const ICO_SIZES = [16, 20, 24, 32, 36, 40, 48, 64, 72, 96, 128, 256]
const TRAY_ICO_SIZES = [16, 20, 24, 32]
const TRAY_PNG_SIZE = 24
const TRAY_TEMPLATE_SIZES = [16, 32]

// PNG entries in an .ico file, which Windows reads since Vista.
function icoFile(images) {
  const head = Buffer.alloc(6 + 16 * images.length)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(images.length, 4)
  let offset = head.length
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16)
    entry[0] = size >= 256 ? 0 : size
    entry[1] = size >= 256 ? 0 : size
    entry[2] = 0
    entry[3] = 0
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += png.length
    return entry
  })
  return Buffer.concat([head, ...entries, ...images.map(({ png }) => png)])
}

const contain = (buffer, size) => sharp(buffer).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()

// The logo is vector, so the marks come from it directly, without the tile: the coloured
// mark, and the template, which is the leaf with its eyes cut out.
const logo = readFileSync(join(assets, 'icon.svg'), 'utf8')
const onTile = /<rect x="100"[^>]*\/>/
const eyes = /<rect x="(?:446|556)"[^>]*\/>/g
if (!onTile.test(logo)) throw new Error('icon: no tile found in assets/icon.svg')
const trimmed = text => sharp(Buffer.from(text), { density: 300 }).resize(1024, 1024).trim()
// The tile's green moves onto the leaf: a white leaf would vanish on a light tray.
const mark = trimmed(logo.replace(onTile, '').replace('fill="#fff"', 'fill="url(#g)"').replaceAll('fill="#0d2a1d"', 'fill="#fff"'))
const cutOut = logo.match(eyes).join('').replaceAll('fill="#0d2a1d"', 'fill="#000000"')
const shape = trimmed(logo.replace(onTile, '').replace(eyes, '')
  .replace('<path ', '<path mask="url(#eyes)" ')
  .replace('</svg>', `<mask id="eyes"><rect width="1024" height="1024" fill="#ffffff"/>${cutOut}</mask></svg>`))

// macOS paints a template image in the menu bar's own colour, so only its alpha matters.
for (const [index, size] of TRAY_TEMPLATE_SIZES.entries()) {
  const png = await contain(await shape.png().toBuffer(), size)
  writeFileSync(join(assets, index === 0 ? 'trayTemplate.png' : 'trayTemplate@2x.png'), png)
}
writeFileSync(join(assets, 'tray.png'), await contain(await mark.png().toBuffer(), TRAY_PNG_SIZE))
writeFileSync(join(assets, 'tray.ico'), icoFile(await Promise.all(TRAY_ICO_SIZES.map(async size => ({ size, png: await contain(await mark.png().toBuffer(), size) })))))

writeFileSync(join(assets, 'icon.ico'), icoFile(await Promise.all(ICO_SIZES.map(async size => ({ size, png: await contain(readFileSync(source), size) })))))

console.log('icon: wrote assets/icon.png, assets/icon.ico, assets/tray.png, assets/tray.ico and the tray templates')
