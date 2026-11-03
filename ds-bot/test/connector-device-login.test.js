import assert from 'node:assert/strict'
import { test } from 'node:test'
import { startGetNoteLogin } from '../src/host/connector-device-login.js'

test('GetNote device login keeps its grant out of the browser link and waits for approval', async () => {
  let calls = 0
  const request = async (url, options) => {
    const body = JSON.parse(options.body)
    assert.ok(body.client_id)
    if (url.endsWith('/device/code')) return Response.json({ success: true, data: { code: 'test-device', verification_uri: 'https://www.biji.com/authorize', user_code: 'TEST', interval: 1, expires_in: 20 } })
    assert.equal(body.code, 'test-device')
    calls += 1
    return Response.json(calls === 1 ? { error: 'authorization_pending' } : { success: true, data: { api_key: 'test-key', client_id: 'cli_test' } })
  }
  const login = await startGetNoteLogin(request, new AbortController().signal)
  assert.equal(login.url, 'https://www.biji.com/authorize')
  assert.deepEqual(await login.wait(), { token: 'test-key', clientId: 'cli_test' })
})
test('cancelling a device login stops polling', async () => {
  const controller = new AbortController()
  const login = await startGetNoteLogin(async () => Response.json({ success: true, data: { code: 'test', verification_uri: 'https://www.biji.com/authorize' } }), controller.signal)
  controller.abort()
  await assert.rejects(login.wait(), { name: 'AbortError' })
})
