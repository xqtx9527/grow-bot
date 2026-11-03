import assert from 'node:assert/strict'
import { test } from 'node:test'
import { install } from '../src/host/prompt.js'
import { fakeContext } from './fake-ctx.js'

function start() {
  const ctx = fakeContext()
  const bots = new Map([
    ['main', { name: 'Chief' }],
    ['worker', { name: 'Dev', instructions: 'Check files.' }],
  ])
  install({
    ctx,
    selfOf: id => id === 'group-worker' ? 'worker' : id,
    botOf: id => bots.get(id),
    roomOf: id => id === 'room' ? {} : undefined,
    isMain: id => id === 'main',
  })
  const prompt = id => ctx.sections.get('bot-identity').text({ agent: { id } })
  return { ctx, prompt }
}

test('Bots get a scoped progress rule without changing the private/group prompt prefix', (t) => {
  const { ctx, prompt } = start()
  t.after(() => ctx.dispose())
  const rules = [
    '- Only for a direct user request in your own chat that needs several steps: write one short sentence of normal reply text before your first tool call, and make that tool call in the same response. Never start such a task with tools alone or end it with a promise. On long tasks, give brief factual updates only at meaningful milestones, then keep working.',
    '- For "[Message from …]" or "[Reply from …]" messages, do not write plans or progress updates: use tools silently, then reply with the answer. Simple answers do not need progress messages.',
    '- In a group chat, the group sees what you write while you work, not only your final reply. For work that takes more than a quick look, start with one short sentence on what you will do, in the same response as your first tool call. After that, write only when you find something the group should know or finish a part of the work, in a sentence or two, not at every step. End with the result. Simple answers need no updates.',
  ]
  for (const id of ['main', 'worker']) {
    for (const rule of rules) {
      assert.ok(prompt(id).split('\n').includes(rule))
      assert.equal(prompt(id).split(rule).length - 1, 1)
    }
  }
  assert.equal(prompt('group-worker'), prompt('worker'))
})

test('Bots are told to keep the chat free while a long command runs as a background job', (t) => {
  const { ctx, prompt } = start()
  t.after(() => ctx.dispose())
  const rule = '- A command or task that takes minutes must not hold the chat: run it as a background job with bash and run_in_background, answer the user while it runs, and collect the result with job_output when you need it (job_list shows what still runs, job_kill stops one). A background job keeps running after the response that started it.'
  for (const id of ['main', 'worker']) {
    assert.ok(prompt(id).split('\n').includes(rule))
    assert.equal(prompt(id).split(rule).length - 1, 1)
  }
  assert.doesNotMatch(prompt('room'), /run_in_background/)
})

test('Bots are told to hand self-contained multi-step work to a subagent', (t) => {
  const { ctx, prompt } = start()
  t.after(() => ctx.dispose())
  const rule = '- For a piece of work that is self-contained and takes many steps, start a subagent with subagent (or subagent_fork when it needs this conversation\'s context) and keep your own chat free: the runtime tells you when it finishes and the child reports back with a message. Do not wait or poll for it; reply to the user meanwhile and handle its report when it arrives. A subagent shares your working folder, not your memory.'
  for (const id of ['main', 'worker']) {
    assert.ok(prompt(id).split('\n').includes(rule))
    assert.equal(prompt(id).split(rule).length - 1, 1)
  }
  assert.doesNotMatch(prompt('room'), /subagent_fork/)
})

test('the group relay and non-Bot sessions do not get progress instructions', (t) => {
  const { ctx, prompt } = start()
  t.after(() => ctx.dispose())
  assert.match(prompt('room'), /end your turn with an empty reply/)
  assert.doesNotMatch(prompt('room'), /progress|milestone/)
  assert.equal(prompt('outside'), '')
})
