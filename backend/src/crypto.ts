import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// AES-256-GCM for secrets at rest (Instagram access tokens). Stored format:
// `v1.<iv>.<authTag>.<ciphertext>`, each part base64url.

const VERSION = 'v1'

function getKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY
  const key = raw ? Buffer.from(raw, 'base64') : null
  if (!key || key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be set to 32 random bytes, base64-encoded')
  }
  return key
}

export function encryptSecret(plaintext: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv, tag, data].map((part) => (typeof part === 'string' ? part : part.toString('base64url'))).join('.')
}

export function decryptSecret(encoded: string) {
  const [version, iv, tag, data] = encoded.split('.')
  if (version !== VERSION || !iv || !tag || !data) {
    throw new Error('Unrecognized encrypted secret format')
  }
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
}
