import { describe, expect, it, test } from 'vitest'
import { getContextLinks, getMoreGroups, getMoreLinks, getPrimaryLinks } from './navConfig'

test('primary catalog destination is labeled Game Catalog', () => {
  expect(getPrimaryLinks().find((l) => l.id === 'library')?.label).toBe('Game Catalog')
  expect(getMoreGroups().find((g) => g.id === 'library')?.label).toBe('Game Catalog')
  expect(getContextLinks('/library').find((l) => l.id === 'section')?.label).toBe(
    'Game Catalog home',
  )
})

test('primary links are locked set without Admin', () => {
  expect(getPrimaryLinks().map((l) => l.id)).toEqual([
    'discover', 'library', 'systems', 'downloads', 'favorites',
  ])
  expect(getPrimaryLinks().some((l) => l.id === 'admin')).toBe(false)
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
  const byId = Object.fromEntries(more.map((l) => [l.id, l.to || l.action]))
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
  expect(byId.friends).toBe('open-friends')
  expect(byId.chat).toBe('open-chat')
  for (const link of more) {
    if (link.id === 'friends' || link.id === 'chat') {
      expect(link.action).toBe(link.id === 'friends' ? 'open-friends' : 'open-chat')
      expect(link.to).toBeUndefined()
      continue
    }
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

/* UIR-5 — the More menu is grouped, not eliminated.
   Bar one answers "where do I go"; bar two answers "what can I do here".
   Two overflows for two different questions is correct; the flat
   seventeen-item list was the actual problem. */

describe('getMoreGroups', () => {
  const ALL = { showTrailers: true, showHelp: true, enableVr: true, enableActivity: true }

  it('loses no destination from the flat list', () => {
    // The guard that matters: grouping must never drop a link on the floor.
    const flat = getMoreLinks(ALL).map((l) => l.id).sort()
    const grouped = getMoreGroups(ALL)
      .flatMap((g) => g.links.map((l) => l.id))
      .sort()
    expect(grouped).toEqual(flat)
  })

  it('adds no destination the flat list does not have', () => {
    const flat = new Set(getMoreLinks(ALL).map((l) => l.id))
    for (const group of getMoreGroups(ALL)) {
      for (const link of group.links) expect(flat.has(link.id)).toBe(true)
    }
  })

  it('puts every link in exactly one group', () => {
    const ids = getMoreGroups(ALL).flatMap((g) => g.links.map((l) => l.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('labels every group it renders', () => {
    for (const group of getMoreGroups(ALL)) {
      expect(group.label).toBeTruthy()
      expect(group.links.length).toBeGreaterThan(0)
    }
  })

  it('drops empty groups rather than rendering a bare heading', () => {
    const minimal = getMoreGroups({ showTrailers: false, showHelp: false, enableVr: false })
    expect(minimal.every((g) => g.links.length > 0)).toBe(true)
    expect(minimal.some((g) => g.id === 'support' && g.links.some((l) => l.id === 'help'))).toBe(false)
  })

  it('respects enableActivity, which the nav previously ignored', () => {
    const on = getMoreGroups({ ...ALL, enableActivity: true })
      .flatMap((g) => g.links.map((l) => l.id))
    const off = getMoreGroups({ ...ALL, enableActivity: false })
      .flatMap((g) => g.links.map((l) => l.id))
    expect(on).toContain('activity')
    expect(off).not.toContain('activity')
  })
})
