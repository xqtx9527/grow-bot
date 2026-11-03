import { setTimeout as delay } from 'node:timers/promises'

const GETNOTE_CLIENT = 'cli_a1b2c3d4e5f6789012345678abcdef90'
const BASE = 'https://openapi.biji.com/open/api/v1/oauth'

// Use the device authorization protocol published by the official GetNote CLI.
// Only the verification URL leaves the Host; the grant is saved through secret-set.
export async function startGetNoteLogin(request = fetch, signal) {
  const post = async (path, body) => {
    const response = await request(`${BASE}/${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
    })
    return response.json()
  }
  const result = await post('device/code', { client_id: GETNOTE_CLIENT })
  const data = result.data
  if (!result.success || !data?.code) throw new Error('Could not start sign-in')
  const url = new URL(data.verification_uri)
  if (url.protocol !== 'https:' || !(url.hostname === 'biji.com' || url.hostname.endsWith('.biji.com'))) throw new Error('Invalid sign-in address')
  return {
    url: url.href, userCode: data.user_code,
    async wait() {
      const deadline = Date.now() + Math.min(data.expires_in || 300, 600) * 1000
      while (Date.now() < deadline) {
        await delay(Math.max(1, data.interval || 5) * 1000, undefined, { signal })
        const answer = await post('token', { grant_type: 'device_code', client_id: GETNOTE_CLIENT, code: data.code })
        if (answer.success && answer.data?.api_key) return { token: answer.data.api_key, clientId: answer.data.client_id || GETNOTE_CLIENT }
        const error = JSON.stringify(answer)
        if (/rejected|expired_token|already_consumed|access_denied/.test(error)) throw new Error('The sign-in did not finish')
        if (!/authorization_pending/.test(error)) throw new Error('Could not complete sign-in. Check your account membership.')
      }
      throw new Error('The sign-in timed out')
    },
  }
}
