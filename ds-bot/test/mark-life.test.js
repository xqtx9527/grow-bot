import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const bundle = await build({
  stdin: {
    contents: "export * from './src/client/mark-life.js'\nexport { SHELL_CSS } from './src/client/styles.js'",
    resolveDir: dirname(dirname(fileURLToPath(import.meta.url))),
  },
  bundle: true, format: 'cjs', platform: 'node', write: false, logLevel: 'silent',
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
})
const module = { exports: {} }
const react = {
  createContext: (initial) => ({ value: initial, Provider: () => null }), useContext: ctx => ctx.value,
  createElement: () => null, useState: initial => [initial, () => {}], useEffect() {}, useLayoutEffect() {}, useRef: current => ({ current }), useCallback: fn => fn, useMemo: make => make(),
}
runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, require: name => (name === 'react' ? react : {}) })
const { SHELL_CSS, leanOf, pokeReaction, stateReaction } = module.exports

const box = { left: 100, top: 100, width: 40, height: 40 }

test('quick clicks climb from a hop to a spin, and more make the character dizzy', () => {
  assert.deepEqual([1, 2, 3, 4].map(pokeReaction), ['hop', 'wiggle', 'spin', 'dizzy'])
})

test('a mark leans toward a pointer in reach and not toward one out of reach', () => {
  const right = leanOf(box, { x: 230, y: 120 })
  assert.ok(right.x > 0 && right.tilt > 0)
  assert.ok(leanOf(box, { x: 10, y: 120 }).tilt < 0)
  assert.equal(leanOf(box, { x: 900, y: 120 }), null)
  assert.equal(leanOf(box, null), null)
})

test('starting work perks a Bot up and a question startles it', () => {
  assert.equal(stateReaction('idle', 'working'), 'perk')
  assert.equal(stateReaction('working', 'alert'), 'surprise')
  assert.equal(stateReaction('working', 'searching'), null)
  assert.equal(stateReaction('working', 'done'), null)
  assert.equal(stateReaction('idle', 'idle'), null)
})

test('every reaction has its motion, and reduced motion stills the lean and the sparks', () => {
  for (const name of ['hop', 'wiggle', 'spin', 'dizzy', 'love', 'perk', 'surprise', 'wake']) {
    assert.ok(SHELL_CSS.includes(`[data-react=${name}]>svg{animation:bt-react-${name} `), name)
    assert.ok(SHELL_CSS.includes(`@keyframes bt-react-${name}{`), name)
  }
  assert.ok(SHELL_CSS.includes('@media(prefers-reduced-motion:reduce){.bt-mark[data-live]>svg{animation:none!important;translate:none;rotate:none}.bt-mark-fx{display:none}}'))
})
