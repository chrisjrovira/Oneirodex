/**
 * Lightweight app orchestration smoke — connection-ux gating used by app.ts
 * without spinning up Tauri or the full companion shell.
 */
import { describe, expect, it } from 'vitest'

import {
  actionNeedsServer,
  connectionModeLabel,
  isActionBlockedOffline,
  offlineBlockReason,
  type CompanionUiAction,
  type ConnectionMode,
} from './connection-ux.js'

/** Mirrors app.ts lifecycle button / command gate for offline server actions. */
function wouldBlockLifecycleAction(
  action: CompanionUiAction,
  mode: ConnectionMode,
): { blocked: boolean; reason: string } {
  const blocked = isActionBlockedOffline(action, mode)
  return {
    blocked,
    reason: blocked ? offlineBlockReason(action) : '',
  }
}

describe('app-smoke (offline gating)', () => {
  it('blocks download when offline (status strip contract)', () => {
    const gate = wouldBlockLifecycleAction('download', 'offline')
    expect(gate.blocked).toBe(true)
    expect(gate.reason).toMatch(/reconnect/i)
    expect(connectionModeLabel('offline')).toMatch(/Offline/)
  })

  it('blocks download and update when disconnected; allows play/install', () => {
    expect(wouldBlockLifecycleAction('download', 'disconnected').blocked).toBe(true)
    expect(wouldBlockLifecycleAction('update', 'disconnected').blocked).toBe(true)
    expect(wouldBlockLifecycleAction('play', 'disconnected').blocked).toBe(false)
    expect(wouldBlockLifecycleAction('install', 'offline').blocked).toBe(false)
  })

  it('does not block server actions while online', () => {
    for (const action of ['download', 'update', 'apply_patch', 'apply_mods'] as const) {
      expect(actionNeedsServer(action)).toBe(true)
      expect(wouldBlockLifecycleAction(action, 'online').blocked).toBe(false)
    }
  })
})
