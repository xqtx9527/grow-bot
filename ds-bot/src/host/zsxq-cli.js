import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
const require = createRequire(import.meta.url)
export function zsxqBinary() {
  const pkg = require.resolve(`@zsxq/cli-${process.platform}-${process.arch}/package.json`)
  return join(dirname(pkg), 'bin', process.platform === 'win32' ? 'zsxq-cli.exe' : 'zsxq-cli').replace('app.asar/', 'app.asar.unpacked/')
}
export function zsxqRun(args, signal) {
  return new Promise((resolve, reject) => {
    execFile(zsxqBinary(), args, { signal, timeout: 600000, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(new Error('Knowledge Planet request failed. Sign in again and retry.'))
      else resolve(stdout)
    })
  })
}
export async function startZsxqLogin(signal) {
  const output = await zsxqRun(['auth', 'login', '--no-browser', '--no-wait', '--json'], signal)
  const match = output.match(/\{[\s\S]*\n\}/)
  if (!match) throw new Error('Could not start sign-in')
  const result = JSON.parse(match[0])
  const data = result.data ?? result
  const url = new URL(data.verification_uri_complete || data.verification_uri)
  if (url.protocol !== 'https:' || !(url.hostname === 'zsxq.com' || url.hostname.endsWith('.zsxq.com'))) throw new Error('Invalid sign-in address')
  if (typeof data.device_code !== 'string') throw new Error('Could not start sign-in')
  return { url: url.href, userCode: data.user_code, wait: () => zsxqRun(['auth', 'login', '--no-browser', '--device-code', data.device_code, '--json'], signal) }
}
