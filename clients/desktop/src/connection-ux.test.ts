import { describe, expect, it } from 'vitest'

import {
  actionNeedsServer,
  connectionModeLabel,
  friendsOpenBlockedReason,
  friendsOpenStatus,
  isActionBlockedOffline,
  offlineBlockReason,
  resolveFriendsBaseUrl,
} from './connection-ux.js'

describe('connection-ux', () => {
  it('marks download/update/apply_patch/apply_mods as server-dependent', () => {
    expect(actionNeedsServer('download')).toBe(true)
    expect(actionNeedsServer('update')).toBe(true)
    expect(actionNeedsServer('apply_patch')).toBe(true)
    expect(actionNeedsServer('apply_mods')).toBe(true)
    expect(actionNeedsServer('install')).toBe(false)
    expect(actionNeedsServer('uninstall')).toBe(false)
    expect(actionNeedsServer('play')).toBe(false)
  })

  it('blocks only server actions when offline or disconnected', () => {
    expect(isActionBlockedOffline('download', 'online')).toBe(false)
    expect(isActionBlockedOffline('download', 'offline')).toBe(true)
    expect(isActionBlockedOffline('install', 'offline')).toBe(false)
    expect(isActionBlockedOffline('play', 'disconnected')).toBe(false)
    expect(isActionBlockedOffline('update', 'disconnected')).toBe(true)
  })

  it('explains blocked server actions', () => {
    expect(offlineBlockReason('download')).toMatch(/reconnect/i)
    expect(offlineBlockReason('install')).toBe('')
  })

  it('labels connection modes for the status strip', () => {
    expect(connectionModeLabel('online')).toBe('Online')
    expect(connectionModeLabel('offline')).toMatch(/Offline/)
    expect(connectionModeLabel('disconnected')).toMatch(/Not connected/)
  })

  it('blocks Friends when server URL is missing', () => {
    expect(friendsOpenBlockedReason('')).toMatch(/Server URL/i)
    expect(friendsOpenBlockedReason('   ')).toMatch(/Server URL/i)
    expect(friendsOpenBlockedReason('https://games.home')).toBeNull()
  })

  it('prefers the form Server URL over a stale auth base', () => {
    expect(resolveFriendsBaseUrl('https://new.home', 'https://old.home')).toBe(
      'https://new.home',
    )
    expect(resolveFriendsBaseUrl('', 'https://old.home')).toBe('https://old.home')
    expect(resolveFriendsBaseUrl('   ', '')).toBe('')
  })

  it('explains Friends open outcomes for offline and auth', () => {
    expect(friendsOpenStatus('focused', 'online').message).toMatch(/focused/i)
    expect(friendsOpenStatus('focused', 'offline').tone).toBe('info')
    expect(friendsOpenStatus('opened', 'disconnected').message).toMatch(/sign in/i)
    expect(friendsOpenStatus('opened', 'offline').message).toMatch(/unreachable/i)
    // Offline/disconnected never blocks Friends open — only missing Server URL does.
    expect(friendsOpenBlockedReason('https://games.home')).toBeNull()
  })
})
