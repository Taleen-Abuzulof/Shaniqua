// Keyword matching for automations. Shared so the API (which saves keywords)
// and the fast path (which matches comments) agree on what "matches" means.
//
// A comment matches when, after both are normalized, it contains a keyword.
// Normalization makes matching forgiving of how people type:
//   - case: "Guide" = "guide"
//   - Arabic vowel marks (harakat, shadda, sukun, superscript alef) are ignored
//   - alef forms أ إ آ ٱ all count as ا; hamza seats ؤ ئ count as و ي
//   - tatweel (ـ) is ignored, so "رابـــط" = "رابط"
//   - Arabic-Indic digits count as 0-9
//   - Latin accents are ignored ("café" = "cafe")
//   - runs of whitespace count as one space

const COMBINING_MARKS = /\p{Mn}/gu
const TATWEEL = /ـ/g
const ALEF_WASLA = /ٱ/g
const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/g
const WHITESPACE = /\s+/g

function toAsciiDigit(digit: string) {
  const code = digit.charCodeAt(0)
  return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660)
}

/**
 * Canonical form used for matching. NFKD splits أ/إ/آ/ؤ/ئ and accented Latin
 * letters into a base letter plus a combining mark, so dropping combining
 * marks handles those along with the harakat.
 */
export function normalizeForMatch(text: string) {
  return text
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(TATWEEL, '')
    .replace(ALEF_WASLA, 'ا')
    .replace(ARABIC_INDIC_DIGITS, toAsciiDigit)
    .toLowerCase()
    .replace(WHITESPACE, ' ')
    .trim()
}

/**
 * True if `comment` contains any of `normalizedKeywords`, which must already
 * be passed through `normalizeForMatch` (so a rule set is normalized once,
 * not on every comment).
 */
export function matchesAnyKeyword(comment: string, normalizedKeywords: readonly string[]) {
  const text = normalizeForMatch(comment)
  return normalizedKeywords.some((keyword) => keyword !== '' && text.includes(keyword))
}
