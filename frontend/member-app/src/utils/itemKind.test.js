import { folderBasename, resolveItemKind, ITEM_KIND_BADGE, ITEM_KIND_LABEL } from './itemKind'

test('resolveItemKind reads item_kind and content_kind alias', () => {
  expect(resolveItemKind({ item_kind: 'emulator' })).toBe('emulator')
  expect(resolveItemKind({ content_kind: 'tool' })).toBe('tool')
  expect(resolveItemKind({ item_kind: 'Experience' })).toBe('experience')
  expect(resolveItemKind({ item_kind: 'game' })).toBe('game')
  expect(resolveItemKind({})).toBe('game')
  expect(resolveItemKind(null)).toBe('game')
})

test('ITEM_KIND_BADGE covers non-game kinds only', () => {
  expect(ITEM_KIND_BADGE.game).toBeUndefined()
  expect(ITEM_KIND_BADGE.experience.label).toBe('EXP')
  expect(ITEM_KIND_BADGE.emulator.label).toBe('EMU')
  expect(ITEM_KIND_BADGE.tool.label).toBe('TOOL')
  expect(ITEM_KIND_LABEL.tool).toBe('Tool')
})

test('folderBasename handles Windows and POSIX paths', () => {
  expect(folderBasename('Z:\\games\\3DSenVR')).toBe('3DSenVR')
  expect(folderBasename('/library/pc/_t/tool-name')).toBe('tool-name')
  expect(folderBasename('')).toBe('')
})
