import { useEffect, useState } from 'react'
import { fetchGameAssists } from '../api/assists'
import { queueClientCommand } from '../api/clientCommands'

/**
 * @param {'full' | 'compact'} [variant='full']
 * @param {'not_downloaded' | 'downloaded' | 'installed' | 'update_available'} [lifecycleState]
 * @param {object | null | undefined} [assistPack] when provided, skips fetch; null hides Assists
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
  assistPack: assistPackProp,
}) {
  const [busyAction, setBusyAction] = useState(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [assistPack, setAssistPack] = useState(
    assistPackProp === undefined ? null : assistPackProp,
  )
  const downloadUrl = downloadHref || `/download_game/${gameUuid}`
  const updatesUrl = updateHref || `/game_details/${gameUuid}#updates`
  const compact = variant === 'compact'

  useEffect(() => {
    if (assistPackProp !== undefined) {
      setAssistPack(assistPackProp)
      return undefined
    }
    if (!gameUuid) {
      setAssistPack(null)
      return undefined
    }
    const controller = new AbortController()
    fetchGameAssists(gameUuid, { signal: controller.signal })
      .then((data) => {
        if (data?.enabled && data?.pack?.toggles?.length) {
          setAssistPack(data.pack)
        } else {
          setAssistPack(null)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAssistPack(null)
        }
      })
    return () => controller.abort()
  }, [gameUuid, assistPackProp])

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
      {assistPack ? (
        <button
          type="button"
          className="gt-action-bar__btn"
          data-action="assists"
          title={
            clientConnected
              ? 'Open single-player assists in the companion'
              : 'Assists require the GameTheca companion (single-player / offline only)'
          }
          onClick={() => {
            const label = clientConnected
              ? 'Assists available in companion overlay'
              : 'Open companion to use Assists (single-player only)'
            setStatusMessage(label)
            if (typeof window !== 'undefined' && window.$?.notify) {
              window.$.notify(label, clientConnected ? 'success' : 'warn')
            }
          }}
        >
          Assists
        </button>
      ) : null}
      {statusMessage ? (
        <span className="gt-action-bar__status" role="status">
          {statusMessage}
        </span>
      ) : null}
    </div>
  )
}
