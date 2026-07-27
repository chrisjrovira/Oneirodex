import { coverUrl, DEFAULT_COVER_URL } from './coverUrl'

test('empty cover falls back to default', () => {
  expect(coverUrl('')).toBe(DEFAULT_COVER_URL)
  expect(coverUrl(null)).toBe(DEFAULT_COVER_URL)
})

test('passes through absolute static and http urls', () => {
  expect(coverUrl('/static/library/images/a.jpg')).toBe('/static/library/images/a.jpg')
  expect(coverUrl('https://images.igdb.com/a.jpg')).toBe('https://images.igdb.com/a.jpg')
})

test('prefixes relative library image paths', () => {
  expect(coverUrl('library/images/a.jpg')).toBe('/static/library/images/a.jpg')
  expect(coverUrl('/library/images/a.jpg')).toBe('/static/library/images/a.jpg')
})

test('normalizes protocol-relative urls', () => {
  expect(coverUrl('//images.igdb.com/co.jpg')).toBe('https://images.igdb.com/co.jpg')
})
