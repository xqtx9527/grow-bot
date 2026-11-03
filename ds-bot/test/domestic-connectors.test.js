import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { domesticConfig, validateDomesticToken } from '../src/host/domestic-connectors.js'

const entry = fileURLToPath(new URL('../src/host/domestic-mcp.js', import.meta.url))
test('domestic credentials never enter process arguments', () => {
  for (const id of ['getnote', 'baidu-netdisk', 'zsxq']) {
    const secret = id === 'zsxq' ? 'https://api.zsxq.com/mcp?api-key=test-only' : 'test-only'
    const config = domesticConfig(id, secret, 'cli_test', entry)
    assert.equal(config.transport, 'stdio')
    assert.equal(JSON.stringify(config.args).includes(secret), false)
    assert.equal(config.env.ELECTRON_RUN_AS_NODE, '1')
    assert.equal(config.env.GETNOTE_API_KEY ?? config.env.GROW_BOT_CONNECTOR_SECRET, secret)
  }
  assert.equal(domesticConfig('notion', 'test-only', null, entry), undefined)
})
test('a private star link must be HTTPS on the official domain and include its key', () => {
  for (const url of ['http://api.zsxq.com/mcp?api-key=x', 'https://zsxq.com.evil.test/mcp?api-key=x', 'https://api.zsxq.com/mcp', 'https://user:pass@api.zsxq.com/mcp?api-key=x']) {
    assert.throws(() => validateDomesticToken('zsxq', url), /official ZSXQ/)
  }
  assert.doesNotThrow(() => validateDomesticToken('zsxq', 'https://api.zsxq.com/mcp?api-key=test-only'))
})
test('the bundled GetNote server exposes its real tools over stdio without an account', async t => {
  const client = new Client({ name: 'grow-bot-test', version: '1' })
  const config = domesticConfig('getnote', 'test-only-not-a-real-key', 'cli_test', entry)
  const transport = new StdioClientTransport({ command: process.execPath, args: config.args, env: config.env, stderr: 'ignore' })
  t.after(() => client.close())
  await client.connect(transport)
  const { tools } = await client.listTools()
  assert.ok(tools.some(tool => tool.name === 'list_notes'))
  assert.ok(tools.some(tool => tool.name === 'save_note'))
})

test('the SSE bridge lists and calls tools, and hides authenticated URLs on failure', async t => {
  const { createServer } = await import('node:http')
  const { Server } = await import('@modelcontextprotocol/sdk/server/index.js')
  const { SSEServerTransport } = await import('@modelcontextprotocol/sdk/server/sse.js')
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js')
  const { ListToolsRequestSchema, CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js')
  const { createBridge } = await import('../src/host/domestic-bridge.js')
  const upstream = new Server({ name: 'mock-netdisk', version: '1' }, { capabilities: { tools: {} } })
  upstream.setRequestHandler(ListToolsRequestSchema, () => ({ tools: [{ name: 'files', inputSchema: { type: 'object' } }] }))
  upstream.setRequestHandler(CallToolRequestSchema, request => {
    if (request.params.arguments?.fail) throw new Error('https://mock.test/?access_token=private-test-value')
    return { content: [{ type: 'text', text: 'mock file' }] }
  })
  let transport
  const http = createServer((req, res) => {
    if (req.method === 'GET') {
      transport = new SSEServerTransport('/messages', res)
      void upstream.connect(transport)
    } else void transport.handlePostMessage(req, res)
  })
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve))
  t.after(() => { http.closeAllConnections(); http.close() })
  const bridge = await createBridge('baidu-netdisk', new URL(`http://127.0.0.1:${http.address().port}/sse`))
  const client = new Client({ name: 'test-host', version: '1' })
  t.after(async () => { await client.close(); await bridge.server.close(); await bridge.remote.close(); await upstream.close() })
  const [left, right] = InMemoryTransport.createLinkedPair()
  await bridge.server.connect(left)
  await client.connect(right)
  assert.equal((await client.listTools()).tools[0].name, 'files')
  assert.equal((await client.callTool({ name: 'files', arguments: {} })).content[0].text, 'mock file')
  const failure = await client.callTool({ name: 'files', arguments: { fail: true } })
  assert.equal(failure.isError, true)
  assert.equal(JSON.stringify(failure).includes('private-test-value'), false)
})

test('Knowledge Planet login launches through the same environment as the host', async t => {
  const client = new Client({ name: 'grow-bot-test', version: '1' })
  const config = domesticConfig('zsxq', 'official-cli-session', undefined, entry)
  const transport = new StdioClientTransport({ command: process.execPath, args: config.args, env: config.env, stderr: 'ignore' })
  t.after(() => client.close())
  await client.connect(transport)
  const { tools } = await client.listTools()
  assert.deepEqual(tools.map(tool => tool.name), ['list_available_tools', 'call_zsxq_api'])
})
