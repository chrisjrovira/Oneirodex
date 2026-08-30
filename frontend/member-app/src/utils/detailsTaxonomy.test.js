import { describe, expect, test } from 'vitest'
import { detailsRootCrumb, primaryGenreName, taxonomyHref } from './detailsTaxonomy'

describe('taxonomyHref', () => {
  test('genre opens the Discover hub', () => {
    expect(taxonomyHref('genre', 'Roguelike')).toBe('/discover/hub/genre/Roguelike')
  })

  test('modes and perspectives filter the catalog', () => {
    expect(taxonomyHref('game_mode', 'Single-player')).toBe(
      '/library?game_mode=Single-player',
    )
    expect(taxonomyHref('player_perspective', 'Side view')).toBe(
      '/library?player_perspective=Side%20view',
    )
    expect(taxonomyHref('theme', 'Horror')).toBe('/library?theme=Horror')
  })
})

describe('detailsRootCrumb', () => {
  test('PC leaves stay on Game Catalog', () => {
    expect(detailsRootCrumb({ library_platform: 'PCWIN' })).toEqual({
      to: '/library',
      label: 'Game Catalog',
    })
  })

  test('console leaves start at Systems', () => {
    expect(detailsRootCrumb({ library_platform: 'NES' })).toEqual({
      to: '/systems',
      label: 'Systems',
    })
  })
})

test('primaryGenreName is the first genre', () => {
  expect(primaryGenreName({ genres: ['Platform', 'Adventure'] })).toBe('Platform')
  expect(primaryGenreName({})).toBe('')
})
