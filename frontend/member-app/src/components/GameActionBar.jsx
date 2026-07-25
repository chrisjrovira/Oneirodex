/**
 * Shared lifecycle actions: Download · Install · Update · Uninstall.
 * Web: Download is live. Install/Update/Uninstall require companion client.
 *
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
}) {
  const downloadUrl = downloadHref || `/download_game/${gameUuid}`
  const updatesUrl = updateHref || `/game_details/${gameUuid}#updates`
  const compact = variant === 'compact'

  const installDisabled = !clientConnected
  const updateDisabled = !clientConnected || lifecycleState !== 'update_available'
  const uninstallDisabled = !clientConnected || lifecycleState === 'not_downloaded'

  const installTitle = clientConnected
    ? 'Install with GameTheca client'
    : 'Install requires the GameTheca companion client'
  const updateTitle = !clientConnected
    ? 'Update requires the GameTheca companion client'
    : lifecycleState === 'update_available'
      ? 'Apply update with GameTheca client'
      : 'No update available'
  const uninstallTitle = !clientConnected
    ? 'Uninstall requires the GameTheca companion client'
    : 'Remove local install only (server library kept)'

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
      >
        Install
      </button>
      <a
        className={`gt-action-bar__btn${updateDisabled && !clientConnected ? ' is-disabled' : ''}`}
        href={clientConnected && lifecycleState === 'update_available' ? updatesUrl : updatesUrl}
        title={updateTitle}
        aria-disabled={updateDisabled}
        data-action="update"
        onClick={(event) => {
          if (!clientConnected) {
            // Still allow navigating to updates/extras on web
            return
          }
          if (lifecycleState !== 'update_available') {
            event.preventDefault()
          }
        }}
      >
        Update
      </a>
      <button
        type="button"
        className="gt-action-bar__btn gt-action-bar__btn--danger"
        disabled={uninstallDisabled}
        title={uninstallTitle}
        aria-disabled={uninstallDisabled}
        data-action="uninstall"
      >
        Uninstall
      </button>
    </div>
  )
}
