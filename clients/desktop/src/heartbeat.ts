import { formatBearerAuthorization } from '@oneirodex/api-client'

import type { AuthStore } from './auth.js'
import type { LifecycleAction } from './lifecycle.js'

const DEVICE_ID_STORAGE_KEY = 'gametheca-device-id'

function getOrCreateDeviceId(): string {
  if (typeof localStorage === 'undefined') {
    return crypto.randomUUID()
  }

  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY)
  if (existing) {
    return existing
  }

  const created = crypto.randomUUID()
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, created)
  return created
}

export interface HeartbeatOptions {
  deviceName?: string
  clientVersion?: string
  deviceId?: string
  fetchImpl?: typeof fetch
  /** Consecutive failed heartbeats before onUnreachable (default 2). */
  unreachableAfterFailures?: number
  /** Fires once when a heartbeat succeeds after connect / after being unreachable. */
  onReachable?: () => void
  /** Fires once after unreachableAfterFailures consecutive failures. */
  onUnreachable?: (error: unknown) => void
}

export type CompanionCommandAction =
  | LifecycleAction
  | 'apply_patch'
  | 'apply_mod_pack'
  | 'open_path'

export interface CompanionCommand {
  id: string
  /** Present for install lifecycle commands; may be empty for unmatched open_path. */
  game_uuid: string
  action: CompanionCommandAction
  created_at?: string
  kind?: 'base' | 'update' | 'extra'
  version_uuid?: string
  /** Absolute OS path for open_path (library folder / unmatched / local install). */
  path?: string
  /** When true (default), select the item in its parent folder if it is a file. */
  select?: boolean
}

export type CompanionCommandResult = 'ok' | 'busy' | 'error'

export type CompanionCommandHandler = (
  command: CompanionCommand,
) => CompanionCommandResult | Promise<CompanionCommandResult | void>

function isCompanionCommandAction(value: string): value is CompanionCommandAction {
  return (
    value === 'download' ||
    value === 'install' ||
    value === 'update' ||
    value === 'uninstall' ||
    value === 'apply_patch' ||
    value === 'apply_mod_pack' ||
    value === 'open_path'
  )
}

async function postCommandResult(
  auth: AuthStore,
  endpoint: 'ack' | 'nack',
  ids: string[],
  fetchImpl: typeof fetch,
): Promise<void> {
  if (ids.length === 0) {
    return
  }
  const baseUrl = auth.getBaseUrl()
  const token = auth.getToken()
  if (!baseUrl || !token) {
    return
  }
  await fetchImpl(`${baseUrl.replace(/\/$/, '')}/api/client/commands/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: formatBearerAuthorization(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  })
}

export async function postClientHeartbeat(
  auth: AuthStore,
  options: HeartbeatOptions = {},
): Promise<CompanionCommand[]> {
  const baseUrl = auth.getBaseUrl()
  const token = auth.getToken()
  if (!baseUrl || !token) {
    return []
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/api/client/heartbeat`, {
    method: 'POST',
    headers: {
      Authorization: formatBearerAuthorization(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      device_id: options.deviceId ?? getOrCreateDeviceId(),
      device_name: options.deviceName ?? 'GameTheca Desktop',
      client_version: options.clientVersion ?? '0.1.0',
    }),
  })

  if (!response.ok) {
    throw new Error(`Heartbeat failed (${response.status})`)
  }

  const data = (await response.json().catch(() => ({}))) as { commands?: unknown }
  const raw = Array.isArray(data.commands) ? data.commands : []
  const parsed: CompanionCommand[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') {
      continue
    }
    const record = row as Record<string, unknown>
    const action = String(record.action || '')
    const gameUuid = String(record.game_uuid || '').trim()
    const path = record.path != null ? String(record.path).trim() : ''
    if (!isCompanionCommandAction(action) || action === 'download') {
      continue
    }
    // Lifecycle commands need a game uuid; open_path needs an absolute path.
    if (action === 'open_path') {
      if (!path) {
        continue
      }
      parsed.push({
        id: String(record.id || crypto.randomUUID()),
        game_uuid: gameUuid,
        action,
        path,
        select: record.select === false ? false : true,
        created_at: record.created_at ? String(record.created_at) : undefined,
      })
      continue
    }
    if (!gameUuid) {
      continue
    }
    parsed.push({
      id: String(record.id || crypto.randomUUID()),
      game_uuid: gameUuid,
      action,
      created_at: record.created_at ? String(record.created_at) : undefined,
      kind:
        record.kind === 'base' || record.kind === 'update' || record.kind === 'extra'
          ? record.kind
          : undefined,
      version_uuid: record.version_uuid ? String(record.version_uuid) : undefined,
    })
  }
  return parsed
}

export interface HeartbeatScheduler {
  stop(): void
}

export function startClientHeartbeat(
  auth: AuthStore,
  options: HeartbeatOptions & {
    intervalMs?: number
    onCommands?: CompanionCommandHandler
  } = {},
): HeartbeatScheduler {
  const intervalMs = options.intervalMs ?? 60_000
  const unreachableAfter = Math.max(1, options.unreachableAfterFailures ?? 2)
  let timer: ReturnType<typeof setInterval> | undefined
  let inFlight = false
  let failureStreak = 0
  let reportedUnreachable = false
  let reachableAnnounced = false

  const tick = (): void => {
    if (inFlight) {
      return
    }
    inFlight = true
    const fetchImpl = options.fetchImpl ?? fetch
    void postClientHeartbeat(auth, options)
      .then(async (commands) => {
        failureStreak = 0
        if (!reachableAnnounced || reportedUnreachable) {
          reportedUnreachable = false
          reachableAnnounced = true
          options.onReachable?.()
        }
        if (!options.onCommands || commands.length === 0) {
          return
        }
        for (const command of commands) {
          let result: CompanionCommandResult = 'ok'
          try {
            const handlerResult = await options.onCommands(command)
            if (handlerResult === 'busy' || handlerResult === 'error' || handlerResult === 'ok') {
              result = handlerResult
            }
          } catch {
            result = 'error'
          }
          try {
            if (result === 'ok') {
              await postCommandResult(auth, 'ack', [command.id], fetchImpl)
            } else {
              await postCommandResult(auth, 'nack', [command.id], fetchImpl)
            }
          } catch {
            // Ack/nack is best-effort; stale reclaim recovers in_flight rows.
          }
        }
      })
      .catch((error) => {
        failureStreak += 1
        if (!reportedUnreachable && failureStreak >= unreachableAfter) {
          reportedUnreachable = true
          reachableAnnounced = false
          options.onUnreachable?.(error)
        }
      })
      .finally(() => {
        inFlight = false
      })
  }

  tick()
  timer = setInterval(tick, intervalMs)

  return {
    stop() {
      if (timer !== undefined) {
        clearInterval(timer)
        timer = undefined
      }
    },
  }
}
