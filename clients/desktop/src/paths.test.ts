import { describe, expect, it } from 'vitest'

import {
  buildDownloadStreamPath,
  buildInitiateDownloadPath,
  buildLocalArchiveName,
  buildLocalInstallDirName,
  joinUrl,
} from './paths.js'

describe('path helpers', () => {
  it('joins base URL and path without duplicate slashes', () => {
    expect(joinUrl('https://example.com/', '/api/collections')).toBe(
      'https://example.com/api/collections',
    )
    expect(joinUrl('https://example.com', 'download_zip/5')).toBe(
      'https://example.com/download_zip/5',
    )
  })

  it('builds initiate and stream paths used by the desktop pipeline', () => {
    const uuid = '11111111-1111-1111-1111-111111111111'
    expect(buildInitiateDownloadPath(uuid)).toBe(`/api/downloads/games/${uuid}`)
    expect(buildDownloadStreamPath(42)).toBe('/download_zip/42')
  })

  it('builds local archive and install directory names', () => {
    const uuid = 'game-42'
    expect(buildLocalArchiveName(uuid)).toBe('game-42.zip')
    expect(buildLocalInstallDirName(uuid)).toBe('game-42')
  })
})
