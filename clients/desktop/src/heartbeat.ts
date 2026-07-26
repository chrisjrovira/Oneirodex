import { formatBearerAuthorization } from '@gametheca/api-client'

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
}

export interface CompanionCommand {
  id: string
  game_uuid: string
  action: LifecycleAction
  created_at?: string
  kind?: 'base' | 'update' | 'extra'
  version_uuid?: string
}

export type CompanionCommandHandler = (command: CompanionCommand) => void | Promise<void>

function isLifecycleAction(value: string): value is LifecycleAction {
  return value === 'download' || value === 'install' || value === 'update' || value === 'uninstall'
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
      client_version: options.clientVersion ?? '0.0.1',
    }),
  })

  if (!response.ok) {
    throw new Error(`Heartbeat failed (${response.status})`)
  }

  const data = (await response.json().catch(() => ({}))) as { commands?: unknown }
  const raw = Array.isArray(data.commands) ? data.commands : []
  return raw.flatMap((row) => {
    if (!row || typeof row !== 'object') {
      return []
    }
    const record = row as Record<string, unknown>
    const action = String(record.action || '')
    const gameUuid = String(record.game_uuid || '').trim()
    if (!gameUuid || !isLifecycleAction(action) || action === 'download') {
      return []
    }
    return [
      {
        id: String(record.id || crypto.randomUUID()),
        game_uuid: gameUuid,
        action,
        created_at: record.created_at ? String(record.created_at) : undefined,
        kind:
          record.kind === 'base' || record.kind === 'update' || record.kind === 'extra'
            ? record.kind
            : undefined,
        version_uuid: record.version_uuid ? String(record.version_uuid) : undefined,
      },
    ]
  })
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
  let timer: ReturnType<typeof setInterval> | undefined

  const tick = (): void => {
    void postClientHeartbeat(auth, options)
      .then(async (commands) => {
        if (!options.onCommands || commands.length === 0) {
          return
        }
        for (const command of commands) {
          await options.onCommands(command)
        }
      })
      .catch(() => {
        // Presence is best-effort; connection UI handles hard failures.
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
