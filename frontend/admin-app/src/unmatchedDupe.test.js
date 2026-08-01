import {
  folderBasename,
  mergeDuplicateHits,
  normalizeMatchedGame,
  resolveSearchName,
} from './unmatchedDupe'

test('folderBasename handles Windows and POSIX paths', () => {
  expect(folderBasename('Z:\\games\\Celeste')).toBe('Celeste')
  expect(folderBasename('/gamess/Celeste')).toBe('Celeste')
  expect(folderBasename('')).toBe('')
})

test('resolveSearchName prefers search_name then display_name then folder_name', () => {
  expect(
    resolveSearchName({
      search_name: ' Clean Title ',
      display_name: 'Display',
      folder_name: 'Folder',
      folder_path: '/games/Raw',
    }),
  ).toBe('Clean Title')
  expect(
    resolveSearchName({
      search_name: null,
      display_name: ' Display ',
      folder_path: '/games/Raw',
    }),
  ).toBe('Display')
  expect(resolveSearchName({ folder_name: 'FromApi', folder_path: '/games/Raw' })).toBe('FromApi')
  expect(resolveSearchName({ folder_path: '/games/Raw' })).toBe('Raw')
})

test('normalizeMatchedGame reads nested matched_game / duplicate_of', () => {
  expect(
    normalizeMatchedGame({
      matched_game: {
        uuid: 'g-1',
        name: 'Celeste',
        path: '/lib/Celeste',
        cover_url: '/covers/1.jpg',
        match_score: 0.99,
      },
    }),
  ).toEqual({
    uuid: 'g-1',
    name: 'Celeste',
    path: '/lib/Celeste',
    cover_url: '/covers/1.jpg',
    match_score: 0.99,
  })
  expect(
    normalizeMatchedGame({
      duplicate_of: { uuid: 'g-2', title: 'Hades', full_disk_path: '/lib/Hades' },
    }),
  ).toEqual({
    uuid: 'g-2',
    name: 'Hades',
    path: '/lib/Hades',
    cover_url: null,
    match_score: undefined,
  })
})

test('normalizeMatchedGame reads flat matched_game_* fields', () => {
  expect(
    normalizeMatchedGame({
      matched_game_uuid: 'g-3',
      matched_game_name: 'Outer Wilds',
      matched_game_path: '/lib/Outer Wilds',
      matched_game_cover_url: '/c.jpg',
      match_score: 0.8,
    }),
  ).toEqual({
    uuid: 'g-3',
    name: 'Outer Wilds',
    path: '/lib/Outer Wilds',
    cover_url: '/c.jpg',
    match_score: 0.8,
  })
  expect(normalizeMatchedGame({ status: 'Unmatched' })).toBeNull()
  // uuid alone is incomplete — soft-enrich from /duplicates instead
  expect(normalizeMatchedGame({ matched_game_uuid: 'g-only' })).toBeNull()
})

test('mergeDuplicateHits fills matched_game from /duplicates candidates', () => {
  const rows = [
    { id: 1, status: 'Duplicate', folder_path: '/games/Celeste' },
    {
      id: 2,
      status: 'Duplicate',
      matched_game: { uuid: 'already', name: 'Keep', path: '/keep' },
    },
  ]
  const merged = mergeDuplicateHits(rows, {
    duplicates: [
      {
        id: 1,
        match_score: 0.95,
        candidates: [
          {
            uuid: 'g-1',
            name: 'Celeste',
            path: '/lib/Celeste',
            cover_url: '/c.jpg',
            match_score: 0.97,
          },
        ],
      },
    ],
  })
  expect(normalizeMatchedGame(merged[0])).toEqual({
    uuid: 'g-1',
    name: 'Celeste',
    path: '/lib/Celeste',
    cover_url: '/c.jpg',
    match_score: 0.97,
  })
  expect(normalizeMatchedGame(merged[1])?.uuid).toBe('already')
})
