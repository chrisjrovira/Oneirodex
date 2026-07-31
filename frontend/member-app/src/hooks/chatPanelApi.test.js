import { canArchiveChannel, canLeaveChannel, slugifyRoomName } from './chatPanelApi'

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
