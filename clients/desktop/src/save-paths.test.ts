import { describe, expect, it } from 'vitest'
import { expandSavePath, hasSavePlaceholder, type PlaceholderResolvers } from './save-paths'

const resolvers: PlaceholderResolvers = {
  home: async () => 'C:\\Users\\chris',
  documents: async () => 'C:\\Users\\chris\\Documents\\',
  appData: async () => 'C:\\Users\\chris\\AppData\\Roaming',
  localAppData: async () => 'C:\\Users\\chris\\AppData\\Local',
  configDir: async () => '/home/chris/.config',
  dataDir: async () => '/home/chris/.local/share',
}

describe('save-path placeholders (INSP-1)', () => {
  it('detects templates', () => {
    expect(hasSavePlaceholder('<winAppData>/Studio/Game')).toBe(true)
    expect(hasSavePlaceholder('C:\\Games\\Thing')).toBe(false)
  })

  it('expands every placeholder for this PC and trims trailing separators', async () => {
    const out = await expandSavePath('<winDocuments>/My Games/Title/Saves', resolvers)
    expect(out).toEqual({ ok: true, path: 'C:\\Users\\chris\\Documents/My Games/Title/Saves' })
    const linux = await expandSavePath('<xdgConfig>/unity3d/Studio/Game', resolvers)
    expect(linux).toEqual({ ok: true, path: '/home/chris/.config/unity3d/Studio/Game' })
  })

  it('refuses rather than guesses when a placeholder is unknown here', async () => {
    expect(await expandSavePath('<base>/save', resolvers)).toEqual({ ok: false, missing: '<base>' })
    expect(await expandSavePath('<storeUserId>/x', resolvers)).toEqual({
      ok: false,
      missing: '<storeUserId>',
    })
    const withBase = await expandSavePath('<base>/save', {
      ...resolvers,
      base: async () => 'D:\\Games\\Title',
    })
    expect(withBase).toEqual({ ok: true, path: 'D:\\Games\\Title/save' })
  })
})
