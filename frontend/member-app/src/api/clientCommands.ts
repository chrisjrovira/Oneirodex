import { postJson } from './client'

/**
 * Queue Install / Update / Uninstall / Apply patch / Open path for the desktop companion.
 * @param {string} gameUuid
 * @param {'install' | 'update' | 'uninstall' | 'apply_patch' | 'apply_mod_pack' | 'open_path' | 'download'} action
 * @param {{ kind?: 'base' | 'update' | 'extra', versionUuid?: string, path?: string, select?: boolean }} [options]
 */
export async function queueClientCommand(gameUuid: any, action: any, options: LooseProps = {}) {
  const body: LooseProps = { game_uuid: gameUuid || '', action }
  if (options.kind) {
    body.kind = options.kind
  }
  if (options.versionUuid) {
    body.version_uuid = options.versionUuid
  }
  if (options.path) {
    body.path = options.path
  }
  if (options.select != null) {
    body.select = Boolean(options.select)
  }
  return (await postJson('/api/client/commands', body, { label: 'client/commands' })) ?? {}
}
