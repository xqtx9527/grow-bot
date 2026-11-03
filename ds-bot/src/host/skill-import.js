// A skill from GitHub, read as text. Only SKILL.md comes across: scripts beside it stay out,
// and nothing is saved until the user has read it in the window.
const MAX_BYTES = 64 * 1024
const TIMEOUT_MS = 10_000
const invalid = message => Object.assign(new Error(message), { code: 'bot/invalid' })

/** The raw addresses to try for a GitHub repository, folder or file. */
export function rawSkillUrls(value) {
  let url
  try { url = new URL(String(value ?? '').trim()) } catch { throw invalid('Enter a GitHub address') }
  if (url.protocol !== 'https:') throw invalid('Enter a GitHub address')
  if (url.hostname === 'raw.githubusercontent.com') return [url.href]
  if (url.hostname !== 'github.com') throw invalid('Enter a GitHub address')
  const [owner, repo, kind, ref, ...path] = url.pathname.split('/').filter(Boolean)
  if (!owner || !repo) throw invalid('Enter a GitHub address')
  const name = repo.replace(/\.git$/, '')
  const raw = (branch, parts) => `https://raw.githubusercontent.com/${owner}/${name}/${branch}/${parts.join('/')}`
  if (kind === 'blob' && ref) return [raw(ref, path)]
  if (kind === 'tree' && ref) return [raw(ref, [...path, 'SKILL.md'])]
  return [raw('main', ['SKILL.md']), raw('master', ['SKILL.md'])]
}

const unquote = text => text.trim().replace(/^(['"])(.*)\1$/, '$2')

/** A SKILL.md's frontmatter and instructions. */
export function parseSkill(text) {
  const match = String(text).replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  const fields = {}
  for (const line of (match?.[1] ?? '').split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z-]+):\s*(.*)$/)
    if (pair) fields[pair[1].toLowerCase()] = unquote(pair[2])
  }
  return { name: fields.name ?? '', description: fields.description ?? '', content: (match?.[2] ?? text).trim() }
}

/** A name the capability library takes. */
export const skillName = text => String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^[^a-z]+|-+$/g, '').slice(0, 32).replace(/-+$/, '') || 'skill'

export async function importSkill(value, { fetch: request = fetch } = {}) {
  for (const address of rawSkillUrls(value)) {
    let response
    try { response = await request(address, { signal: AbortSignal.timeout(TIMEOUT_MS) }) } catch { throw invalid('Could not reach GitHub') }
    if (response.status === 404) continue
    if (!response.ok) throw invalid(`GitHub answered ${response.status}`)
    const text = await response.text()
    if (Buffer.byteLength(text) > MAX_BYTES) throw invalid('This skill is too large')
    const skill = parseSkill(text)
    if (skill.content === '') throw invalid('This skill is empty')
    const fallback = new URL(address).pathname.split('/').filter(Boolean).slice(0, -1).at(-1)
    return { ...skill, name: skillName(skill.name || fallback), source: address }
  }
  throw invalid('No SKILL.md at this address')
}
