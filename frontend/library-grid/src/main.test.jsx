import {
  parseDiscoverRootConfig,
  parseFavoritesRootConfig,
  parseRootConfig,
} from './main'

test('parses Library template data attributes', () => {
  const root = document.createElement('div')
  root.dataset.perPage = '50'
  root.dataset.defaultSort = 'rating'
  root.dataset.defaultSortOrder = 'desc'
  root.dataset.isAdmin = 'true'
  root.dataset.showPlayStatus = 'false'
  root.dataset.libraryCount = '2'
  root.dataset.gamesCount = '12'
  root.dataset.enableDeleteOnDisk = 'true'
  root.dataset.discordConfigured = 'false'
  root.dataset.discordManualTrigger = 'false'
  root.dataset.currentFilters = '{"genre":"Action"}'

  expect(parseRootConfig(root)).toEqual({
    perPage: 50,
    defaultSort: 'rating',
    defaultSortOrder: 'desc',
    isAdmin: true,
    showPlayStatus: false,
    libraryCount: 2,
    gamesCount: 12,
    enableDeleteOnDisk: true,
    discordConfigured: false,
    discordManualTrigger: false,
    currentFilters: { genre: 'Action' },
  })
})

test('parses Favorites template data attributes', () => {
  const root = document.createElement('div')
  root.dataset.isAdmin = 'false'
  root.dataset.showPlayStatus = 'true'

  expect(parseFavoritesRootConfig(root)).toEqual({
    isAdmin: false,
    showPlayStatus: true,
  })
})

test('parses Discover template data attributes', () => {
  const root = document.createElement('div')
  root.dataset.sections =
    '[{"identifier":"latest_games","title":"Latest Games","games":[]}]'
  root.dataset.isAdmin = 'true'

  expect(parseDiscoverRootConfig(root)).toEqual({
    sections: [
      {
        identifier: 'latest_games',
        title: 'Latest Games',
        games: [],
      },
    ],
    isAdmin: true,
  })
})

test('falls back to no sections when Discover data is invalid', () => {
  const root = document.createElement('div')
  root.dataset.sections = '{'
  root.dataset.isAdmin = 'false'

  expect(parseDiscoverRootConfig(root)).toEqual({
    sections: [],
    isAdmin: false,
  })
})
