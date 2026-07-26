import { useState } from 'react'
import { queueClientCommand } from '../api/clientCommands'

/**
 * @param {'full' | 'compact'} [variant='full']
 * @param {'not_downloaded' | 'downloaded' | 'installed' | 'update_available'} [lifecycleState]
 */
export function GameActionBar({
  gameUuid,
  gameName = 'game',
  variant = 'full',
  lifecycleState = 'not_downloaded',
  clientConnected = false,
  downloadHref,
  updateHref,
  className = '',
  onCommandQueued,
}) {
  const [busyAction, setBusyAction] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const downloadUrl = downloadHref || `/download_game/${gameUuid}`
  const updatesUrl = updateHref || `/game_details/${gameUuid}#updates`
  const compact = variant === 'compact'

  // Local companion enables install/update/uninstall. Web alone can still open Update extras.
  const installDisabled =
    !clientConnected ||
    lifecycleState !== 'downloaded' ||
    busyAction != null
  const updateDisabled = lifecycleState !== 'update_available' || busyAction != null
  const uninstallDisabled =
    !clientConnected ||
    lifecycleState === 'not_downloaded' ||
    busyAction != null

  const installTitle = !clientConnected
    ? 'Install requires the GameTheca companion client (keep it open while browsing)'
    : lifecycleState === 'installed' || lifecycleState === 'update_available'
      ? 'Already installed on this device'
      : lifecycleState === 'downloaded'
        ? 'Install with GameTheca client'
        : 'Download first, then install with the companion client'
  const updateTitle =
    lifecycleState === 'update_available'
      ? clientConnected
        ? 'Apply update with GameTheca client'
        : 'View updates / extras (companion needed to apply)'
      : 'No update available'
  const uninstallTitle = !clientConnected
    ? 'Uninstall requires the GameTheca companion client'
    : 'Remove local install only (server library kept)'

  async function sendCommand(action) {
    if (!gameUuid || busyAction) {
      return
    }
    setBusyAction(action)
    setStatusMessage('')
    try {
      await queueClientCommand(gameUuid, action)
      const label =
        action === 'install'
          ? 'Install queued for companion'
          : action === 'update'
            ? 'Update queued for companion'
            : 'Uninstall queued for companion'
      setStatusMessage(label)
      onCommandQueued?.(action)
      if (typeof window !== 'undefined' && window.$?.notify) {
        window.$.notify(label, 'success')
      }
    } catch (err) {
      const message = err?.message || `Failed to queue ${action}`
      setStatusMessage(message)
      if (typeof window !== 'undefined' && window.$?.notify) {
        window.$.notify(message, 'error')
      }
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div
      className={`gt-action-bar${compact ? ' gt-action-bar--compact' : ''} ${className}`.trim()}
      role="group"
      aria-label={`Actions for ${gameName}`}
      data-lifecycle={lifecycleState}
      data-client={clientConnected ? 'connected' : 'absent'}
    >
      <a className="gt-action-bar__btn gt-action-bar__btn--primary" href={downloadUrl}>
        Download
      </a>
      <button
        type="button"
        className="gt-action-bar__btn"
        disabled={installDisabled}
        title={installTitle}
        aria-disabled={installDisabled}
        data-action="install"
        onClick={() => {
          void sendCommand('install')
        }}
      >
        {busyAction === 'install' ? 'Queuing…' : 'Install'}
      </button>
      {clientConnected && lifecycleState === 'update_available' ? (
        <button
          type="button"
          className="gt-action-bar__btn"
          disabled={updateDisabled}
          title={updateTitle}
          aria-disabled={updateDisabled}
          data-action="update"
          onClick={() => {
            void sendCommand('update')
          }}
        >
          {busyAction === 'update' ? 'Queuing…' : 'Update'}
        </button>
      ) : (
        <a
          className={`gt-action-bar__btn${updateDisabled ? ' is-disabled' : ''}`}
          href={updatesUrl}
          title={updateTitle}
          aria-disabled={updateDisabled}
          data-action="update"
          onClick={(event) => {
            if (updateDisabled) {
              event.preventDefault()
            }
          }}
        >
          Update
        </a>
      )}
      <button
        type="button"
        className="gt-action-bar__btn gt-action-bar__btn--danger"
        disabled={uninstallDisabled}
        title={uninstallTitle}
        aria-disabled={uninstallDisabled}
        data-action="uninstall"
        onClick={() => {
          void sendCommand('uninstall')
        }}
      >
        {busyAction === 'uninstall' ? 'Queuing…' : 'Uninstall'}
      </button>
      {statusMessage ? (
        <span className="gt-action-bar__status" role="status">
          {statusMessage}
        </span>
      ) : null}
    </div>
  )
}
