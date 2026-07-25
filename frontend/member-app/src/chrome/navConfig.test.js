import { getPrimaryLinks, getMoreLinks } from './navConfig'

test('primary links are locked set', () => {
  expect(getPrimaryLinks().map((l) => l.id)).toEqual([
    'discover', 'library', 'downloads', 'favorites', 'admin',
  ])
})

test('admin is external dashboard path', () => {
  const admin = getPrimaryLinks().find((l) => l.id === 'admin')
  expect(admin.href).toBe('/admin/dashboard')
  expect(admin.external).toBe(true)
})

test('more links exclude primary ids', () => {
  const more = getMoreLinks({ showTrailers: true, showHelp: true, enableVr: true })
  const ids = more.map((l) => l.id)
  expect(ids).not.toContain('discover')
  expect(ids).toContain('collections')
  expect(ids).toContain('vr')
})

test('more links use Flask paths from base.html', () => {
  const more = getMoreLinks({ showTrailers: true, showHelp: true, enableVr: true })
  const byId = Object.fromEntries(more.map((l) => [l.id, l.href]))
  expect(byId.collections).toBe('/collections')
  expect(byId.news).toBe('/news')
  expect(byId.wishlist).toBe('/wishlist')
  expect(byId.updates).toBe('/updates')
  expect(byId.playtime).toBe('/playtime')
  expect(byId.calendar).toBe('/calendar')
  expect(byId.ownership).toBe('/ownership')
  expect(byId['big-picture']).toBe('/big-picture')
  expect(byId.vr).toBe('/vr')
  expect(byId.trailers).toBe('/trailers')
  expect(byId.help).toBe('/help')
})

test('optional more links omitted when flags false', () => {
  const ids = getMoreLinks({ showTrailers: false, showHelp: false, enableVr: false }).map((l) => l.id)
  expect(ids).not.toContain('vr')
  expect(ids).not.toContain('trailers')
  expect(ids).not.toContain('help')
})