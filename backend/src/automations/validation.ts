import { normalizeForMatch } from '@shaniqua/shared/keywords'

// Instagram caps message text at 1000 characters and button titles at 20.
// The frontend side panel uses the same limits.
export const MESSAGE_MAX = 1000
export const BUTTON_TEXT_MAX = 20
export const KEYWORD_MAX = 50
export const KEYWORDS_MAX_COUNT = 30
export const URLS_MAX_COUNT = 10
export const URL_MAX = 2000
export const NAME_MAX = 100

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/** Counts characters the way people see them, so Arabic and emoji count once. */
function charCount(value: string) {
  return [...value].length
}

function requireString(value: unknown, field: string) {
  if (typeof value !== 'string') throw new ValidationError(`${field} must be a string.`)
  return value
}

function requireStringArray(value: unknown, field: string) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new ValidationError(`${field} must be a list of strings.`)
  }
  return value as string[]
}

/** Trims, collapses whitespace, and drops keywords that match the same text as an earlier one. */
export function parseKeywords(value: unknown) {
  const keywords: string[] = []
  const seen = new Set<string>()
  for (const raw of requireStringArray(value, 'keywords')) {
    const keyword = raw.trim().replace(/\s+/g, ' ')
    const key = normalizeForMatch(keyword)
    // A keyword made only of vowel marks or tatweel would match every comment.
    if (!key || seen.has(key)) continue
    if (charCount(keyword) > KEYWORD_MAX) {
      throw new ValidationError(`Keep each trigger word under ${KEYWORD_MAX} characters.`)
    }
    seen.add(key)
    keywords.push(keyword)
  }
  if (keywords.length === 0) throw new ValidationError('Add at least one trigger word.')
  if (keywords.length > KEYWORDS_MAX_COUNT) {
    throw new ValidationError(`Use at most ${KEYWORDS_MAX_COUNT} trigger words.`)
  }
  return keywords
}

export function parseMessage(value: unknown) {
  const message = requireString(value, 'message').trim()
  if (!message) throw new ValidationError('Write the message people will receive.')
  if (charCount(message) > MESSAGE_MAX) {
    throw new ValidationError(`Keep the message under ${MESSAGE_MAX} characters.`)
  }
  return message
}

export function parseButtonText(value: unknown) {
  const buttonText = requireString(value, 'buttonText').trim()
  if (!buttonText) throw new ValidationError('Give the button a label.')
  if (charCount(buttonText) > BUTTON_TEXT_MAX) {
    throw new ValidationError(`Keep the button text under ${BUTTON_TEXT_MAX} characters.`)
  }
  return buttonText
}

export function parseUrls(value: unknown) {
  const urls = requireStringArray(value, 'urls')
    .map((url) => url.trim())
    .filter(Boolean)
  if (urls.length === 0) throw new ValidationError('Add at least one link.')
  if (urls.length > URLS_MAX_COUNT) throw new ValidationError(`Use at most ${URLS_MAX_COUNT} links.`)
  for (const url of urls) {
    let parsed: URL | null = null
    try {
      parsed = new URL(url)
    } catch {
      // handled below
    }
    if (!parsed || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || url.length > URL_MAX) {
      throw new ValidationError(`Not a valid link: ${url}`)
    }
  }
  return urls
}

export function parseName(value: unknown) {
  if (value === null || value === undefined) return null
  const name = requireString(value, 'name').trim()
  if (charCount(name) > NAME_MAX) throw new ValidationError(`Keep the name under ${NAME_MAX} characters.`)
  return name || null
}

export function parseStatus(value: unknown) {
  if (value !== 'active' && value !== 'paused') {
    throw new ValidationError('status must be "active" or "paused".')
  }
  return value
}

export function parseUuid(value: unknown, field: string) {
  const id = requireString(value, field)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError(`${field} is not a valid id.`)
  }
  return id
}
