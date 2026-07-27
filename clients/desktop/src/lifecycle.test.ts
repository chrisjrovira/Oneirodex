import { describe, expect, it } from 'vitest'
import { createLifecycleRegistry, transitionLifecycle } from './lifecycle.js'

describe('lifecycle state machine', () => {
  it('follows download → install → update_available → update', () => {
    let state = transitionLifecycle('not_downloaded', 'download')
    expect(state).toBe('downloaded')
    state = transitionLifecycle(state, 'install')
    expect(state).toBe('installed')
    state = transitionLifecycle(state, 'uninstall')
    expect(state).toBe('downloaded')
  })

  it('tracks per-game state in registry', () => {
    const registry = createLifecycleRegistry()
    registry.apply('game-1', 'download')
    registry.apply('game-1', 'install')
    registry.signalUpdateAvailable('game-1')
    expect(registry.get('game-1')).toBe('update_available')
    registry.apply('game-1', 'update')
    expect(registry.get('game-1')).toBe('installed')
  })

  it('merges server records without wiping local state', () => {
    const registry = createLifecycleRegistry({
      initial: [{ gameUuid: 'local', state: 'installed' }],
    })
    registry.merge([
      { gameUuid: 'local', state: 'downloaded' },
      { gameUuid: 'remote', state: 'downloaded' },
    ])
    expect(registry.get('local')).toBe('installed')
    expect(registry.get('remote')).toBe('downloaded')
  })
})
