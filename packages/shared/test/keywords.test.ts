import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchesAnyKeyword, normalizeForMatch } from '../src/keywords.js'

test('ignores case and collapses whitespace', () => {
  assert.equal(normalizeForMatch('  Free   GUIDE '), 'free guide')
})

test('ignores Arabic vowel marks', () => {
  assert.equal(normalizeForMatch('رَابِطٌ'), 'رابط')
  assert.equal(normalizeForMatch('مُحَمَّد'), 'محمد')
})

test('treats alef forms as one letter', () => {
  for (const word of ['أحمد', 'إحمد', 'آحمد', 'ٱحمد', 'احمد']) {
    assert.equal(normalizeForMatch(word), 'احمد', word)
  }
})

test('drops tatweel and maps Arabic-Indic digits', () => {
  assert.equal(normalizeForMatch('رابـــط'), 'رابط')
  assert.equal(normalizeForMatch('كود ١٢٣ ۴۵'), 'كود 123 45')
})

test('ignores Latin accents', () => {
  assert.equal(normalizeForMatch('Café'), 'cafe')
})

test('matches a comment that contains any keyword', () => {
  const keywords = ['guide', 'أرسل الرابط'].map(normalizeForMatch)
  assert.equal(matchesAnyKeyword('Send me the GUIDE please!', keywords), true)
  assert.equal(matchesAnyKeyword('ارسِل الرابط من فضلك', keywords), true)
  assert.equal(matchesAnyKeyword('nice video', keywords), false)
})

test('never matches an empty keyword', () => {
  assert.equal(matchesAnyKeyword('anything', ['']), false)
})
