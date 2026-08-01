import {
  canArchiveChannel,
  canLeaveChannel,
  isImageAttachment,
  normalizeAttachments,
  slugifyRoomName,
} from './chatPanelApi'

test('slugifyRoomName lowercases and hyphens', () => {
  expect(slugifyRoomName('Party Night!')).toBe('party-night')
  expect(slugifyRoomName('  ##general  ')).toBe('general')
  expect(slugifyRoomName('')).toBe('')
})

test('canArchiveChannel allows librarian or creator on household rooms', () => {
  const room = { id: 1, kind: 'channel', created_by_user_id: 9 }
  expect(canArchiveChannel(room, { isLibrarian: true })).toBe(true)
  expect(canArchiveChannel(room, { isAdmin: true })).toBe(true)
  expect(canArchiveChannel(room, { userId: 9 })).toBe(true)
  expect(canArchiveChannel(room, { userId: 3 })).toBe(false)
  expect(canArchiveChannel({ id: 2, kind: 'dm' }, { isLibrarian: true })).toBe(false)
  expect(canArchiveChannel(null, { isLibrarian: true })).toBe(false)
})

test('canLeaveChannel requires an active room id', () => {
  expect(canLeaveChannel({ id: 1, kind: 'dm' })).toBe(true)
  expect(canLeaveChannel({})).toBe(false)
  expect(canLeaveChannel(null)).toBe(false)
})

test('normalizeAttachments and isImageAttachment feature-detect payload shapes', () => {
  expect(isImageAttachment({ content_type: 'image/png', filename: 'a.png' })).toBe(true)
  expect(isImageAttachment({ filename: 'notes.txt', content_type: 'text/plain' })).toBe(false)
  expect(normalizeAttachments([{ id: 1, url: '/a.png', filename: 'a.png', mime: 'image/png' }])).toEqual([
    {
      id: 1,
      url: '/a.png',
      filename: 'a.png',
      content_type: 'image/png',
      size: null,
    },
  ])
  expect(normalizeAttachments(null)).toEqual([])
})
