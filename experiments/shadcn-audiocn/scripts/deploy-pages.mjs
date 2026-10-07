import { execFileSync } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const repo = '/repos/fcrespo82/ringlight'
const domain = 'ringlight.crespo.com.br'
await readFile(join(dist, 'index.html'))
const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
async function api(path, method = 'GET', body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text(), value = text ? JSON.parse(text) : {}
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${value.message}`)
  return value
}
const files = []
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await collect(path)
    else if (entry.isFile()) {
      const data = await readFile(path), name = relative(dist, path)
      if (/\.(png|jpg|jpeg|ico|woff2?)$/.test(name)) {
        const blob = await api(`${repo}/git/blobs`, 'POST', { content: data.toString('base64'), encoding: 'base64' })
        files.push({ path: name, mode: '100644', type: 'blob', sha: blob.sha })
      } else files.push({ path: name, mode: '100644', type: 'blob', content: data.toString('utf8') })
    }
  }
}
await collect(dist)
files.push({ path: '.nojekyll', mode: '100644', type: 'blob', content: '' })
const previous = await api(`${repo}/git/ref/heads/gh-pages`)
const tree = await api(`${repo}/git/trees`, 'POST', { tree: files })
const commit = await api(`${repo}/git/commits`, 'POST', { message: 'Deploy shadcn ringlight PWA', tree: tree.sha, parents: [previous.object.sha] })
await api(`${repo}/git/refs/heads/gh-pages`, 'PATCH', { sha: commit.sha, force: false })
await api(`${repo}/pages`, 'PUT', { build_type: 'legacy', source: { branch: 'gh-pages', path: '/' }, cname: domain })
// Keep production HTTPS enforced whenever GitHub has issued the certificate.
const pages = await api(`${repo}/pages`)
if (!pages.https_enforced) {
  try {
    await api(`${repo}/pages`, 'PUT', { https_enforced: true })
  } catch (error) {
    if (!error.message.includes('certificate does not exist yet')) throw error
    console.log('Certificado HTTPS pendente no GitHub; ative Enforce HTTPS após a emissão.')
  }
}
console.log(`Build enviado: https://github.com/fcrespo82/ringlight/commit/${commit.sha}`)
console.log(`Acompanhe a publicação: https://github.com/fcrespo82/ringlight/actions`)
console.log(`Site: https://${domain}`)
