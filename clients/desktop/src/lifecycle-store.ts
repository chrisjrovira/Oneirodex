import { invoke } from '@tauri-apps/api/core'

import {
  createLifecycleRegistry,
  isGameLifecycleState,
  type GameLifecycleRecord,
  type GameLifecycleState,
  type LifecycleRegistry,
} from './lifecycle.js'
import { isTauriRuntime } from './config-store.js'

interface RawLifecycleRecord {
  game_uuid: string
  state: string
}

interface RawLifecycleRegistryFile {
  records?: RawLifecycleRecord[]
}

function toRawRecords(records: GameLifecycleRecord[]): RawLifecycleRecord[] {
  return records.map((record) => ({
    game_uuid: record.gameUuid,
    state: record.state,
  }))
}

function fromRawRecords(records: RawLifecycleRecord[] | undefined): GameLifecycleRecord[] {
  if (!records) {
    return []
  }

  return records.flatMap((record) => {
    if (!isGameLifecycleState(record.state)) {
      return []
    }
    return [{ gameUuid: record.game_uuid, state: record.state }]
  })
}

export async function loadLifecycleRegistryFromDisk(): Promise<GameLifecycleRecord[]> {
  if (!isTauriRuntime()) {
    return []
  }

  const raw = await invoke<RawLifecycleRegistryFile>('load_lifecycle_registry')
  return fromRawRecords(raw.records)
}

export async function saveLifecycleRegistryToDisk(records: GameLifecycleRecord[]): Promise<void> {
  if (!isTauriRuntime()) {
    return
  }

  await invoke('save_lifecycle_registry', {
    registry: {
      records: toRawRecords(records),
    },
  })
}

export interface PersistedLifecycleRegistryOptions {
  initial?: GameLifecycleRecord[]
  persist?: (records: GameLifecycleRecord[]) => void | Promise<void>
}

export function createPersistedLifecycleRegistry(
  options: PersistedLifecycleRegistryOptions = {},
): LifecycleRegistry {
  const registry = createLifecycleRegistry({
    initial: options.initial,
    onChange: (records) => {
      void options.persist?.(records)
    },
  })

  return registry
}

export async function hydrateLifecycleRegistry(): Promise<LifecycleRegistry> {
  const initial = await loadLifecycleRegistryFromDisk()
  return createPersistedLifecycleRegistry({
    initial,
    persist: saveLifecycleRegistryToDisk,
  })
}

export type { GameLifecycleRecord, GameLifecycleState, LifecycleRegistry }
