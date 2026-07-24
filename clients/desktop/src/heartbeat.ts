import { formatBearerAuthorization } from '@gametheca/api-client'

import type { AuthStore } from './auth.js'

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

export async function postClientHeartbeat(
  auth: AuthStore,
  options: HeartbeatOptions = {},
): Promise<void> {
  const baseUrl = auth.getBaseUrl()
  const token = auth.getToken()
  if (!baseUrl || !token) {
    return
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
}

export interface HeartbeatScheduler {
  stop(): void
}

export function startClientHeartbeat(
  auth: AuthStore,
  options: HeartbeatOptions & { intervalMs?: number } = {},
): HeartbeatScheduler {
  const intervalMs = options.intervalMs ?? 60_000
  let timer: ReturnType<typeof setInterval> | undefined

  const tick = (): void => {
    void postClientHeartbeat(auth, options).catch(() => {
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
