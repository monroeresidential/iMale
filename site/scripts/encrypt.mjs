#!/usr/bin/env node
/**
 * Encrypts the record into public/data.enc and every attachment into public/att/<id>.enc.
 *
 * The published site contains ONLY ciphertext. Without the password there is nothing
 * readable in the bundle — no email text, no names, no plans.
 *
 * Plaintext and password live OUTSIDE this directory, in ../private/ (gitignored):
 *
 *   ../private/content.json   the record, rebuilt by ../derived/build_content.py
 *   ../private/att/*.bin      attachment bytes, keyed by content hash
 *   ../private/password.txt   the access password
 *
 *   node scripts/encrypt.mjs                 # uses the existing password
 *   node scripts/encrypt.mjs --new           # generates a fresh 80-bit password
 *   node scripts/encrypt.mjs "my password"   # sets a specific password
 *
 * The password is never printed. Read ../private/password.txt to see it.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync, readdirSync, rmSync } from 'node:fs'
import { randomBytes, pbkdf2Sync, createCipheriv } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PRIVATE = resolve(ROOT, '..', 'private')
const CONTENT = resolve(PRIVATE, 'content.json')
const ATT = resolve(PRIVATE, 'att')
const PW_FILE = resolve(PRIVATE, 'password.txt')
const OUT_ATT = resolve(ROOT, 'public/att')

const ITERATIONS = 310000 // PBKDF2-SHA256
const MIN_CUSTOM_LENGTH = 16

// 80 bits of CSPRNG entropy as 4 groups of 4. 32-char alphabet → no modulo bias;
// ambiguous glyphs (0/O, 1/I/L, U) excluded so it survives being read aloud.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ#@'
function generatePassword() {
  const bytes = randomBytes(16)
  let out = ''
  for (let i = 0; i < 16; i++) {
    out += ALPHABET[bytes[i] & 31]
    if (i % 4 === 3 && i < 15) out += '-'
  }
  return out
}

function writePassword(value) {
  mkdirSync(PRIVATE, { recursive: true })
  writeFileSync(PW_FILE, value + '\n', { mode: 0o600 })
  try { chmodSync(PW_FILE, 0o600) } catch { /* best effort */ }
}

const arg = process.argv[2]
let password
let rotated = false

if (arg === '--new') {
  password = generatePassword(); writePassword(password); rotated = true
} else if (arg && !arg.startsWith('--')) {
  password = arg.trim()
  if (password.length < MIN_CUSTOM_LENGTH && process.argv[3] !== '--force') {
    console.error(
      `Refusing a ${password.length}-character password. data.enc is published, so a short\n` +
      `password can be cracked offline. Use at least ${MIN_CUSTOM_LENGTH} characters, run with --new for a\n` +
      `generated one, or append --force if you accept the risk.`
    )
    process.exit(1)
  }
  writePassword(password); rotated = true
} else if (existsSync(PW_FILE)) {
  password = readFileSync(PW_FILE, 'utf8').trim()
} else {
  password = generatePassword(); writePassword(password); rotated = true
  console.log('No password file found — generated one.')
}

if (!password) { console.error(`${PW_FILE} is empty. Aborting.`); process.exit(1) }
if (!existsSync(CONTENT)) { console.error(`${CONTENT} not found. Run: npm run data`); process.exit(1) }

const salt = randomBytes(16)
const key = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256')
function seal(buf) {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key, iv)
  return { iv, ct: Buffer.concat([c.update(buf), c.final(), c.getAuthTag()]) }
}

const plaintext = Buffer.from(readFileSync(CONTENT, 'utf8'), 'utf8')
const main = seal(plaintext)
mkdirSync(resolve(ROOT, 'public'), { recursive: true })
writeFileSync(resolve(ROOT, 'public/data.enc'), JSON.stringify({
  v: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, cipher: 'AES-256-GCM',
  salt: salt.toString('base64'), iv: main.iv.toString('base64'), ct: main.ct.toString('base64'),
}))

// Attachments: same key, own IV. File layout is iv(12) || ciphertext||tag.
// Filenames are content hashes, so they reveal nothing about the document.
rmSync(OUT_ATT, { recursive: true, force: true })
mkdirSync(OUT_ATT, { recursive: true })
let n = 0, bytes = 0
for (const f of existsSync(ATT) ? readdirSync(ATT) : []) {
  if (!f.endsWith('.bin')) continue
  const { iv, ct } = seal(readFileSync(resolve(ATT, f)))
  writeFileSync(resolve(OUT_ATT, f.replace(/\.bin$/, '.enc')), Buffer.concat([iv, ct]))
  n++; bytes += ct.length
}

console.log(`Encrypted ${(plaintext.length / 1024).toFixed(0)} KB record → public/data.enc`)
console.log(`Encrypted ${n} attachments (${(bytes / 1048576).toFixed(1)} MB) → public/att/`)
if (rotated) {
  console.log('Password rotated. Read it from private/password.txt — it is not printed here.')
  console.log('Anyone holding a previously downloaded copy keeps access to that older copy.')
} else {
  console.log('Re-encrypted with the existing password in private/password.txt.')
}
