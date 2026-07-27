import { getContextLinks, getPrimaryLinks, getMoreLinks } from './navConfig'

test('primary links are locked set', () => {
  expect(getPrimaryLinks().map((l) => l.id)).toEqual([
    'discover', 'library', 'systems', 'downloads', 'favorites', 'admin',
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

test('more links use SPA paths via to', () => {
  const more = getMoreLinks({ showTrailers: true, showHelp: true, enableVr: true })
  const byId = Object.fromEntries(more.map((l) => [l.id, l.to]))
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
  for (const link of more) {
    expect(link.to).toBeTruthy()
    expect(link.href).toBeUndefined()
  }
})

test('optional more links omitted when flags false', () => {
  const ids = getMoreLinks({ showTrailers: false, showHelp: false, enableVr: false }).map((l) => l.id)
  expect(ids).not.toContain('vr')
  expect(ids).not.toContain('trailers')
  expect(ids).not.toContain('help')
})

test('context links always include Home and Admin when admin', () => {
  const links = getContextLinks('/updates', { isAdmin: true })
  expect(links.map((l) => l.id)).toEqual(['home', 'section', 'admin-home'])
  expect(links[0].to).toBe('/discover')
  expect(links[1].to).toBe('/updates')
  expect(links[2].href).toBe('/admin/dashboard')
})

test('context links omit Admin for members', () => {
  const links = getContextLinks('/library', { isAdmin: false })
  expect(links.map((l) => l.id)).toEqual(['home', 'section'])
})
