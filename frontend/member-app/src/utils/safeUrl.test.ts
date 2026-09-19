import { safeHttpUrl } from './safeUrl'

test('safeHttpUrl allows http(s) and blocks javascript', () => {
  expect(safeHttpUrl('https://igdb.com/games/1')).toBe('https://igdb.com/games/1')
  expect(safeHttpUrl('http://example.com')).toBe('http://example.com/')
  expect(safeHttpUrl('javascript:alert(1)')).toBeNull()
  expect(safeHttpUrl('')).toBeNull()
})
