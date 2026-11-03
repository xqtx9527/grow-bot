import assert from 'node:assert/strict'
import { test } from 'node:test'
import { importSkill, parseSkill, rawSkillUrls, skillName } from '../src/host/skill-import.js'

const page = (status, body = '') => ({ status, ok: status === 200, text: async () => body })
const BASE = 'https://raw.githubusercontent.com/o/r'

test('a GitHub address becomes the raw SKILL.md it names', () => {
  assert.deepEqual(rawSkillUrls('https://github.com/o/r'), [`${BASE}/main/SKILL.md`, `${BASE}/master/SKILL.md`])
  assert.deepEqual(rawSkillUrls('https://github.com/o/r/tree/dev/skills/a'), [`${BASE}/dev/skills/a/SKILL.md`])
  assert.deepEqual(rawSkillUrls('https://github.com/o/r/blob/dev/a/SKILL.md'), [`${BASE}/dev/a/SKILL.md`])
  for (const bad of ['http://github.com/o/r', 'https://evil.example/o/r', 'https://github.com/o', 'nonsense']) assert.throws(() => rawSkillUrls(bad), /GitHub address/)
})

test('a skill reads its name and description from the frontmatter', () => {
  assert.deepEqual(parseSkill('---\nname: "My Skill"\ndescription: Does a thing\n---\n\n# Steps\nDo it.\n'), { name: 'My Skill', description: 'Does a thing', content: '# Steps\nDo it.' })
  assert.deepEqual(parseSkill('Just text'), { name: '', description: '', content: 'Just text' })
  assert.equal(skillName('My Skill!'), 'my-skill')
  assert.equal(skillName('123'), 'skill')
})

test('import tries the next branch, and refuses what is missing, empty or too large', async () => {
  const seen = []
  const skill = await importSkill('https://github.com/o/r', { fetch: async (url) => { seen.push(url); return url.includes('/main/') ? page(404) : page(200, '---\nname: tool\n---\nBody') } })
  assert.equal(seen.length, 2)
  assert.deepEqual([skill.name, skill.content], ['tool', 'Body'])
  await assert.rejects(importSkill('https://github.com/o/r', { fetch: async () => page(404) }), /No SKILL\.md/)
  await assert.rejects(importSkill('https://github.com/o/r', { fetch: async () => page(200, '---\nname: a\n---\n') }), /empty/)
  await assert.rejects(importSkill('https://github.com/o/r', { fetch: async () => page(200, 'x'.repeat(70_000)) }), /too large/)
})
