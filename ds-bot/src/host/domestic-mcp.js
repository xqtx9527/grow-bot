// A private stdio child bridges legacy SSE without changing the DSH MCP client.
import { CLI_SESSION } from './domestic-connectors.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createBridge } from './domestic-bridge.js'
import { validateDomesticToken } from './domestic-connectors.js'

// Transport errors can contain the authenticated URL. Never forward them to Host logs.
console.error = () => {}
const id = process.argv[2]
try {
  if (id === 'getnote') {
    await import('@getnote/mcp')
  } else if (id === 'zsxq' && process.env.GROW_BOT_CONNECTOR_SECRET === CLI_SESSION) {
    await import('./zsxq-mcp.js')
  } else {
    const secret = process.env.GROW_BOT_CONNECTOR_SECRET
    if (!secret) throw new Error('Missing authorization')
    validateDomesticToken(id, secret)
    if (!['baidu-netdisk', 'zsxq'].includes(id)) throw new Error('Unknown connector')
    const url = id === 'baidu-netdisk' ? new URL('https://mcp-pan.baidu.com/sse') : new URL(secret)
    if (id === 'baidu-netdisk') url.searchParams.set('access_token', secret)
    const { remote, server } = await createBridge(id, url)
    const close = async () => { await remote.close(); await server.close() }
    process.once('SIGTERM', () => { void close().finally(() => process.exit(0)) })
    process.stdin.once('end', () => { void close().finally(() => process.exit(0)) })
    await server.connect(new StdioServerTransport())
  }
} catch {
  process.stderr.write('Connector failed. Check your authorization and try again.\n')
  process.exit(1)
}
