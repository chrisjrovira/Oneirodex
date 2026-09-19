import { describe, expect, test } from 'vitest'
import { groupCatalogGamesByGenre } from './catalogGridGroups'

describe('groupCatalogGamesByGenre', () => {
  test('buckets by first genre and keeps first-seen order', () => {
    const games = [
      { uuid: '1', genres: ['Action', 'RPG'] },
      { uuid: '2', genres: ['RPG'] },
      { uuid: '3', genres: ['Action'] },
      { uuid: '4', genres: [] },
    ]
    const sections = groupCatalogGamesByGenre(games)
    expect(sections.map((s) => s.title)).toEqual(['Action', 'RPG', 'Uncategorized'])
    expect(sections[0].games.map((g) => g.uuid)).toEqual(['1', '3'])
    expect(sections[1].games.map((g) => g.uuid)).toEqual(['2'])
    expect(sections[2].games.map((g) => g.uuid)).toEqual(['4'])
  })
})
