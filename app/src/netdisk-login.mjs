import { BrowserWindow } from 'electron'
import { randomBytes } from 'node:crypto'

// The official personal trial app uses Baidu's out-of-band redirect. Capture only
// that OAuth result, never cookies or credentials entered on the login page.
export function netdiskLogin(parent) {
  return new Promise((resolve, reject) => {
    const state = randomBytes(24).toString('hex')
    const url = new URL('https://openapi.baidu.com/oauth/2.0/authorize')
    url.search = new URLSearchParams({ response_type: 'token', client_id: 'QHOuRXiepJBMjtk0esLhrPoNlQyYd0mF', redirect_uri: 'oob', scope: 'basic,netdisk', state }).toString()
    const win = new BrowserWindow({ parent, width: 720, height: 760, title: 'Baidu Netdisk', webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, partition: 'grow-bot-netdisk-login' } })
    let finished = false
    const finish = (error, token) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      if (!win.isDestroyed()) win.close()
      if (error) reject(new Error(error)); else resolve(token)
    }
    const timer = setTimeout(() => finish('The sign-in timed out'), 300000)
    const inspect = (_event, target) => {
      let parsed
      try { parsed = new URL(target) } catch { return }
      if (parsed.origin !== 'https://openapi.baidu.com' || parsed.pathname !== '/oauth/2.0/login_success') return
      const params = new URLSearchParams(parsed.hash.slice(1))
      if (params.get('state') !== state) return
      if (params.get('access_token')) finish(null, params.get('access_token'))
      else if (params.get('error')) finish('The sign-in did not finish')
    }
    win.webContents.on('will-redirect', inspect)
    win.webContents.on('did-navigate', inspect)
    win.webContents.on('did-navigate-in-page', inspect)
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.on('closed', () => finish(null, null))
    void win.loadURL(url.href).catch(() => finish('Could not open sign-in'))
  })
}
