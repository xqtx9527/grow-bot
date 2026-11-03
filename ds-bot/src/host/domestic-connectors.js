// Provider credentials stay in the secret store and the child environment, never argv.
// ZSXQ's sign-in lives in its official CLI; this marker only says so.
export const CLI_SESSION = 'official-cli-session'

export function validateDomesticToken(id, token) {
  if (id !== 'zsxq' || token === CLI_SESSION) return
  let url
  try { url = new URL(token) } catch { throw new Error('Paste the official ZSXQ MCP link') }
  if (url.protocol !== 'https:' || !(url.hostname === 'zsxq.com' || url.hostname.endsWith('.zsxq.com')) || url.username || url.password || !url.searchParams.get('api-key')) {
    throw new Error('Paste the official ZSXQ MCP link')
  }
}

export function domesticConfig(id, token, clientId, entry) {
  if (!['getnote', 'baidu-netdisk', 'zsxq'].includes(id)) return undefined
  validateDomesticToken(id, token)
  return {
    transport: 'stdio', serverName: id, command: process.execPath, args: [entry, id],
    env: { ELECTRON_RUN_AS_NODE: '1', ...(id === 'getnote'
      ? { GETNOTE_API_KEY: token, GETNOTE_CLIENT_ID: clientId }
      : { GROW_BOT_CONNECTOR_SECRET: token }) },
    failOnStartupError: true,
  }
}
