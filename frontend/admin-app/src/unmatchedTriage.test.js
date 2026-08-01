import {
  detectLeafType,
  detectPlatformMismatch,
  folderBasename,
  formatPlatformMismatchTitle,
  isGarbageScaffolding,
} from './unmatchedTriage'

test('folderBasename handles Windows and POSIX paths', () => {
  expect(folderBasename('D:\\Roms\\Neo Geo CD\\game.zip')).toBe('game.zip')
  expect(folderBasename('/library/Super Mario')).toBe('Super Mario')
})

test('detectLeafType classifies ROM file vs folder leaf', () => {
  expect(detectLeafType('/Roms/Neo Geo CD/KOF94.zip')).toBe('file-leaf')
  expect(detectLeafType('/Roms/Super Nintendo/Chrono Trigger')).toBe('folder-leaf')
  expect(detectLeafType('Z:\\games\\Celeste\\')).toBe('folder-leaf')
})

test('detectPlatformMismatch flags path platform vs assigned library platform', () => {
  const hit = detectPlatformMismatch(
    '/media/Neo Geo CD/games/foo.zip',
    'Atari 2600 Library',
    'Atari 2600',
  )
  expect(hit).not.toBeNull()
  expect(hit.pathHint).toMatch(/neo geo/i)
  expect(hit.assignedPlatform).toBe('Atari 2600')
})

test('detectPlatformMismatch returns null when path aligns with assignment', () => {
  expect(
    detectPlatformMismatch('/Roms/Atari 2600/Pitfall.bin', 'Atari Vault', 'Atari 2600'),
  ).toBeNull()
})

test('isGarbageScaffolding detects redistributable scaffolding', () => {
  expect(
    isGarbageScaffolding({
      folder_path: '/PC/Game/_CommonRedist/vcredist_x64.exe',
      status: 'Unmatched',
    }),
  ).toBe(true)
  expect(
    isGarbageScaffolding({
      folder_path: '/Roms/SNES/Chrono Trigger',
      status: 'Unmatched',
    }),
  ).toBe(false)
})

test('formatPlatformMismatchTitle is readable for badge tooltips', () => {
  const title = formatPlatformMismatchTitle({
    pathHint: 'neo geo cd',
    assignedPlatform: 'Atari 2600',
    libraryName: 'Atari Vault',
  })
  expect(title).toMatch(/Neo Geo Cd/i)
  expect(title).toMatch(/Atari Vault/)
})
