import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { zsxqRun } from './zsxq-cli.js'
const server = new Server({ name: 'zsxq', version: '1.0.0' }, { capabilities: { tools: {} } })
server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: [
  { name: 'list_available_tools', description: 'List official Knowledge Planet API methods and their parameters before calling them.', inputSchema: { type: 'object', properties: {} } },
  { name: 'call_zsxq_api', description: 'Call an official Knowledge Planet API method. Discover methods with list_available_tools first. Ask the user before publishing, deleting or modifying content.', inputSchema: { type: 'object', properties: { method: { type: 'string' }, params: { type: 'object' } }, required: ['method'] } },
] }))
server.setRequestHandler(CallToolRequestSchema, async request => {
  try {
    const { name, arguments: args = {} } = request.params
    if (name !== 'list_available_tools' && (name !== 'call_zsxq_api' || typeof args.method !== 'string' || !/^[a-z][a-z0-9_]{0,80}$/.test(args.method))) throw new Error('Unknown method')
    const output = await zsxqRun(name === 'list_available_tools' ? ['api', 'list'] : ['api', 'call', args.method, '--params', JSON.stringify(args.params ?? {})])
    return { content: [{ type: 'text', text: output }] }
  } catch { return { isError: true, content: [{ type: 'text', text: 'Knowledge Planet request failed. Check your login and permissions.' }] } }
})
await server.connect(new StdioServerTransport())
