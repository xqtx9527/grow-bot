// A private stdio child bridges legacy SSE without changing the DSH MCP client.
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'


export async function createBridge(id, url) {
  const remote = new Client({ name: 'grow-bot-connectors', version: '1.0.0' })
  const transport = id === 'baidu-netdisk' ? new SSEClientTransport(url) : new StreamableHTTPClientTransport(url)
  await remote.connect(transport, { timeout: 30_000 })
  const server = new Server({ name: id, version: '1.0.0' }, { capabilities: { tools: {} } })
  server.setRequestHandler(ListToolsRequestSchema, async request => {
    try { return await remote.listTools(request.params) } catch { throw new Error('Could not list tools. Check your authorization.') }
  })
  server.setRequestHandler(CallToolRequestSchema, async request => {
    try { return await remote.callTool(request.params) } catch { return { isError: true, content: [{ type: 'text', text: 'The connector request failed. Check your authorization and try again.' }] } }
  })
  return { remote, server }
}
