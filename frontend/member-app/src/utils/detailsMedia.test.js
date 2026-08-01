import {
  adminPathRows,
  extrasPanelModel,
  formatVersionSize,
  isVersionDownloadable,
  isVersionPathMissing,
  parseVideoUrls,
  showsRetroarchCheats,
  trailerEmbedUrls,
  youtubeDemoLink,
  youtubeEmbed,
} from './detailsMedia'

test('parseVideoUrls accepts CSV and lists', () => {
  expect(parseVideoUrls('a, b ,c')).toEqual(['a', 'b', 'c'])
  expect(parseVideoUrls(['x', '', 'y'])).toEqual(['x', 'y'])
  expect(parseVideoUrls(null)).toEqual([])
})

test('isVersionDownloadable honors path_missing and downloadable flags', () => {
  expect(isVersionDownloadable({ label: 'Base' })).toBe(true)
  expect(isVersionDownloadable({ downloadable: true })).toBe(true)
  expect(isVersionDownloadable({ downloadable: false })).toBe(false)
  expect(isVersionDownloadable({ path_missing: true })).toBe(false)
  expect(isVersionDownloadable({ path_missing: true, downloadable: true })).toBe(false)
  expect(isVersionDownloadable(null)).toBe(false)
})

test('isVersionPathMissing and formatVersionSize', () => {
  expect(isVersionPathMissing({ path_missing: true })).toBe(true)
  expect(isVersionPathMissing({ downloadable: false })).toBe(true)
  expect(isVersionPathMissing({ label: 'ok' })).toBe(false)
  expect(formatVersionSize('1.2 GB')).toBe('1.2 GB')
  expect(formatVersionSize(1024)).toBe('1 KB')
  expect(formatVersionSize(null)).toBeNull()
  expect(formatVersionSize('')).toBeNull()
})

test('youtubeEmbed handles watch, short, and embed URLs', () => {
  expect(youtubeEmbed('https://www.youtube.com/watch?v=abc123DEF')).toBe(
    'https://www.youtube.com/embed/abc123DEF',
  )
  expect(youtubeEmbed('https://youtu.be/abc123DEF')).toBe(
    'https://www.youtube.com/embed/abc123DEF',
  )
  expect(youtubeEmbed('https://www.youtube.com/embed/abc123DEF')).toBe(
    'https://www.youtube.com/embed/abc123DEF',
  )
  expect(youtubeEmbed('https://example.com')).toBeNull()
})

test('trailerEmbedUrls prefers trailers[].embed_url over video_urls', () => {
  expect(
    trailerEmbedUrls({
      trailers: [
        {
          url: 'https://www.youtube.com/watch?v=abc123DEF',
          embed_url: 'https://www.youtube.com/embed/abc123DEF',
          provider: 'youtube',
        },
      ],
      has_trailers: true,
      video_urls: ['https://www.youtube.com/watch?v=other99'],
    }),
  ).toEqual(['https://www.youtube.com/embed/abc123DEF'])

  expect(
    trailerEmbedUrls({
      video_urls: ['https://youtu.be/fallback1'],
    }),
  ).toEqual(['https://www.youtube.com/embed/fallback1'])

  expect(trailerEmbedUrls({ has_trailers: true, trailers: [] })).toEqual([])
  expect(trailerEmbedUrls(null)).toEqual([])
})

test('youtubeDemoLink prefers youtube_demo_url then demo_url then urls', () => {
  expect(
    youtubeDemoLink({ youtube_demo_url: 'https://youtu.be/fromPayload' }),
  ).toEqual({ href: 'https://youtu.be/fromPayload', label: 'YouTube demo' })
  expect(
    youtubeDemoLink({ demo_url: 'https://youtu.be/abc123DEF' }),
  ).toEqual({ href: 'https://youtu.be/abc123DEF', label: 'YouTube demo' })
  expect(
    youtubeDemoLink({
      urls: [{ type: 'youtube', url: 'https://youtube.com/watch?v=abc123DEF' }],
    }),
  ).toEqual({
    href: 'https://youtube.com/watch?v=abc123DEF',
    label: 'YouTube',
  })
  expect(youtubeDemoLink({})).toBeNull()
})

test('showsRetroarchCheats requires cheat_surface retroarch', () => {
  expect(showsRetroarchCheats({ cheat_surface: 'retroarch' })).toBe(true)
  expect(showsRetroarchCheats({ cheat_surface: 'RETROARCH' })).toBe(true)
  expect(showsRetroarchCheats({ cheat_surface: 'none' })).toBe(false)
  expect(showsRetroarchCheats({ library_platform: 'SNES' })).toBe(false)
  expect(showsRetroarchCheats({ library_platform: 'PCWIN' })).toBe(false)
  expect(showsRetroarchCheats(null)).toBe(false)
})

test('adminPathRows uses full_disk_path and server_path for admins', () => {
  expect(adminPathRows({ is_admin: false, full_disk_path: '/games/a' })).toEqual([])
  expect(
    adminPathRows({
      is_admin: true,
      full_disk_path: '/games/a',
      server_path: '/mnt/user/games/a',
    }),
  ).toEqual([
    { label: 'Library folder', path: '/games/a' },
    { label: 'Server path', path: '/mnt/user/games/a' },
  ])
  expect(
    adminPathRows({
      is_admin: true,
      full_disk_path: '/games/a',
      server_path: '/games/a',
    }),
  ).toEqual([{ label: 'Library folder', path: '/games/a' }])
  expect(
    adminPathRows({
      is_admin: true,
      full_disk_path: '/games/a',
      admin_paths: [
        { label: 'Library folder', path: '/games/a' },
        { label: 'Extra', path: '/games/a/dlc' },
      ],
    }),
  ).toEqual([
    { label: 'Library folder', path: '/games/a' },
    { label: 'Extra', path: '/games/a/dlc' },
  ])
})

test('extrasPanelModel prefers Backend extras and falls back to versions', () => {
  expect(extrasPanelModel({}, [], { loading: true }).loading).toBe(true)
  const fromExtras = extrasPanelModel({
    extras: [
      {
        uuid: 'e1',
        name: 'DLC Pack',
        type: 'dlc',
        extra_kind: 'dlc',
        on_server: true,
        download_url: '/download_other/extra/g1/e1',
      },
    ],
  })
  expect(fromExtras.source).toBe('extras')
  expect(fromExtras.rows[0]).toMatchObject({
    label: 'DLC Pack',
    kind: 'dlc',
    on_server: true,
    download_url: '/download_other/extra/g1/e1',
  })

  const emptyExtras = extrasPanelModel({ extras: [] }, [
    { kind: 'extra', uuid: 'x1', label: 'Should not show' },
  ])
  expect(emptyExtras.source).toBe('extras')
  expect(emptyExtras.rows).toEqual([])

  const fromVersions = extrasPanelModel(
    { uuid: 'g1' },
    [
      { kind: 'base', uuid: 'b', label: 'Base' },
      { kind: 'extra', uuid: 'x1', label: 'Manual', extra_kind: 'manual' },
    ],
  )
  expect(fromVersions.source).toBe('versions')
  expect(fromVersions.rows).toHaveLength(1)
  expect(fromVersions.rows[0].download_url).toContain('/download_other/extra/g1/x1')

  const missingExtra = extrasPanelModel(
    { uuid: 'g1' },
    [{ kind: 'extra', uuid: 'x2', label: 'Gone', path_missing: true }],
  )
  expect(missingExtra.rows[0].download_url).toBeNull()
  expect(missingExtra.rows[0].path_missing).toBe(true)
})
