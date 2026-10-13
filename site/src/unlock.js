// Password → PBKDF2 key → AES-GCM decrypt. Nothing readable exists until this succeeds.

const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function deriveKey(password, salt, iterations) {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    true,
    ['decrypt']
  )
}

async function decrypt(blob, key) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64(blob.iv) }, key, b64(blob.ct)
  )
  return JSON.parse(new TextDecoder().decode(plain))
}

let blobPromise = null
function loadBlob() {
  if (!blobPromise) {
    blobPromise = fetch(`${import.meta.env.BASE_URL}data.enc`, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load the record (HTTP ${r.status}).`)
        return r.json()
      })
  }
  return blobPromise
}

const SESSION_KEY = 'record.k'
let activeKey = null

/** Try a password. Resolves with the content, or throws with a readable message. */
export async function unlockWithPassword(password) {
  const blob = await loadBlob()
  const key = await deriveKey(password, b64(blob.salt), blob.iterations)
  let content
  try {
    content = await decrypt(blob, key)
  } catch {
    throw new Error('That password does not match. Check for stray spaces, then try again.')
  }
  activeKey = key
  try {
    const jwk = await crypto.subtle.exportKey('jwk', key)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(jwk))
  } catch { /* private mode — the tab just won't remember */ }
  return content
}

/** Re-open with the key held for this tab, if there is one. */
export async function unlockFromSession() {
  let jwk
  try {
    jwk = sessionStorage.getItem(SESSION_KEY)
  } catch { return null }
  if (!jwk) return null
  try {
    const key = await crypto.subtle.importKey(
      'jwk', JSON.parse(jwk), { name: 'AES-GCM', length: 256 }, true, ['decrypt']
    )
    const content = await decrypt(await loadBlob(), key)
    activeKey = key
    return content
  } catch {
    lock()
    return null
  }
}

export function lock() {
  activeKey = null
  try { sessionStorage.removeItem(SESSION_KEY) } catch { /* no-op */ }
}

const urlCache = new Map()
const INLINE = /^(application\/pdf|image\/(png|jpeg|gif|webp))$/

/** Decrypt one attachment (iv || ciphertext) and return an object URL for it. */
export async function fileUrl(file) {
  if (urlCache.has(file.id)) return urlCache.get(file.id)
  if (!activeKey) throw new Error('The record is locked.')
  const r = await fetch(`${import.meta.env.BASE_URL}att/${file.id}.enc`)
  if (!r.ok) throw new Error(`Could not load the file (HTTP ${r.status}).`)
  const buf = new Uint8Array(await r.arrayBuffer())
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, activeKey, buf.slice(12))
  // Only PDFs and raster images are given their real type. Anything else (SVG, HTML, …)
  // could run script on this origin if opened, so it is typed as an opaque download.
  const type = INLINE.test(file.type) ? file.type : 'application/octet-stream'
  const url = URL.createObjectURL(new Blob([plain], { type }))
  urlCache.set(file.id, url)
  return url
}

/** Open an attachment in a new tab. The tab is opened synchronously so popup blockers allow it. */
export async function openFile(file) {
  const w = INLINE.test(file.type) ? window.open('', '_blank') : null
  if (w) w.opener = null
  try {
    const url = await fileUrl(file)
    if (w) { w.location.href = url; return }
    const a = document.createElement('a')
    a.href = url; a.download = file.name
    document.body.appendChild(a); a.click(); a.remove()
  } catch (err) {
    if (w) w.close()
    alert(err.message)
  }
}
