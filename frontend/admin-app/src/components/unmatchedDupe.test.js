import {
  buildDupeCompare,
  folderBasename,
  formatByteSize,
  formatDiskDate,
  mergeDuplicateHits,
  normalizeMatchedGame,
  pickDiskDate,
  pickDiskSizeBytes,
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
    size_bytes: null,
    mtime: null,
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
    size_bytes: null,
    mtime: null,
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
    size_bytes: null,
    mtime: null,
  })
  expect(normalizeMatchedGame({ status: 'Unmatched' })).toBeNull()
  // uuid alone is incomplete — soft-enrich from /duplicates instead
  expect(normalizeMatchedGame({ matched_game_uuid: 'g-only' })).toBeNull()
})

test('normalizeMatchedGame soft-reads size/date when Backend provides them', () => {
  expect(
    normalizeMatchedGame({
      matched_game: {
        uuid: 'g-4',
        name: 'Hades',
        path: '/lib/Hades',
        size_bytes: 1048576,
        date_identified: '2024-06-01T12:00:00Z',
      },
    }),
  ).toMatchObject({
    uuid: 'g-4',
    size_bytes: 1048576,
    mtime: '2024-06-01T12:00:00.000Z',
  })
})

test('pickDiskSizeBytes / formatByteSize soft-degrade when missing', () => {
  expect(pickDiskSizeBytes(null)).toBeNull()
  expect(pickDiskSizeBytes({})).toBeNull()
  expect(pickDiskSizeBytes({ size_bytes: 2048 })).toBe(2048)
  expect(formatByteSize(null)).toBeNull()
  expect(formatByteSize(512)).toBe('512 B')
  expect(formatByteSize(2048)).toBe('2 KB')
  expect(formatByteSize(5 * 1024 * 1024)).toBe('5 MB')
})

test('pickDiskDate / formatDiskDate soft-degrade when missing', () => {
  expect(pickDiskDate(null)).toBeNull()
  expect(pickDiskDate({})).toBeNull()
  expect(pickDiskDate({ folder_mtime: '2024-01-15T08:30:00Z' })).toBe('2024-01-15T08:30:00.000Z')
  expect(formatDiskDate(null)).toBeNull()
  expect(formatDiskDate('2024-01-15T08:30:00Z')).toMatch(/2024/)
})

test('buildDupeCompare builds folder vs library sides with honest empties', () => {
  const compare = buildDupeCompare({
    status: 'Duplicate',
    folder_path: '/games/Celeste',
    search_name: 'Celeste',
    matched_game: {
      uuid: 'g-1',
      name: 'Celeste',
      path: '/library/Celeste',
      cover_url: '/c.jpg',
      match_score: 0.98,
    },
  })
  expect(compare.folder).toMatchObject({
    role: 'folder',
    label: 'This folder',
    name: 'Celeste',
    path: '/games/Celeste',
    size_bytes: null,
    mtime: null,
  })
  expect(compare.library).toMatchObject({
    role: 'library',
    name: 'Celeste',
    path: '/library/Celeste',
    uuid: 'g-1',
    size_bytes: null,
    mtime: null,
  })
  expect(buildDupeCompare({ status: 'Unmatched', folder_path: '/games/X' })).toBeNull()
  expect(
    buildDupeCompare({
      status: 'Duplicate',
      folder_path: '/games/OnlyLeft',
    }),
  ).toMatchObject({
    folder: { path: '/games/OnlyLeft' },
    library: null,
  })
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
    size_bytes: null,
    mtime: null,
  })
  expect(normalizeMatchedGame(merged[1])?.uuid).toBe('already')
})
