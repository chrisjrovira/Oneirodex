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
}) {
  const downloadUrl = downloadHref || `/download_game/${gameUuid}`
  const updatesUrl = updateHref || `/game_details/${gameUuid}#updates`
  const compact = variant === 'compact'

  // Local companion enables install/update/uninstall. Web alone can still open Update extras.
  const installDisabled =
    !clientConnected || lifecycleState === 'installed' || lifecycleState === 'update_available'
  const updateDisabled = lifecycleState !== 'update_available'
  const uninstallDisabled = !clientConnected || lifecycleState === 'not_downloaded'

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
