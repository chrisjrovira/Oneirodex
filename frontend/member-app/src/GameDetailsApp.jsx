import { BadgeStack } from './components/BadgeStack'
import { GameActionBar } from './components/GameActionBar'

/**
 * React island for game details — badges, lifecycle actions, meta summary.
 * Mounted beside (or replacing) the Jinja action strip.
 */
export function GameDetailsApp({
  gameUuid,
  gameName,
  lifecycleState = 'not_downloaded',
  clientConnected = false,
  freshnessStatus = null,
  dateIdentified = null,
  firstReleaseDate = null,
  owned = false,
  storeOwned = false,
  hltbMain = null,
  hltbExtra = null,
  hltbComplete = null,
  sizeLabel = null,
  libraryUuid = null,
}) {
  const game = {
    uuid: gameUuid,
    name: gameName,
    lifecycle_state: lifecycleState,
    client_connected: clientConnected,
    freshness_status: freshnessStatus,
    date_identified: dateIdentified,
    first_release_date: firstReleaseDate,
    owned,
    store_owned: storeOwned,
  }

  const hltbBits = [
    hltbMain != null ? `Main ${Number(hltbMain).toFixed(1)}h` : null,
    hltbExtra != null ? `+Extras ${Number(hltbExtra).toFixed(1)}h` : null,
    hltbComplete != null ? `100% ${Number(hltbComplete).toFixed(1)}h` : null,
  ].filter(Boolean)

  return (
    <div className="gt-details-react" data-game-uuid={gameUuid}>
      <div className="gt-details-react__badges">
        <BadgeStack game={game} preferredCorner="bottom-left" maxVisible={2} />
      </div>
      <div className="gt-details-react__meta">
        {sizeLabel ? <span className="chip">{sizeLabel}</span> : null}
        {freshnessStatus ? (
          <span className="chip" title="Store freshness">
            Freshness: {freshnessStatus}
          </span>
        ) : null}
        {hltbBits.length > 0 ? (
          <span className="chip" title="HowLongToBeat">
            HLTB: {hltbBits.join(' · ')}
          </span>
        ) : null}
        {libraryUuid ? (
          <span className="chip" title="Library">
            Library {String(libraryUuid).slice(0, 8)}…
          </span>
        ) : null}
      </div>
      <GameActionBar
        gameUuid={gameUuid}
        gameName={gameName}
        lifecycleState={lifecycleState}
        clientConnected={clientConnected}
        variant="full"
      />
    </div>
  )
}

export function parseGameDetailsRootConfig(rootElement) {
  return {
    gameUuid: rootElement.dataset.gameUuid || '',
    gameName: rootElement.dataset.gameName || 'game',
    lifecycleState: rootElement.dataset.lifecycleState || 'not_downloaded',
    clientConnected: rootElement.dataset.clientConnected === 'true',
    freshnessStatus: rootElement.dataset.freshnessStatus || null,
    dateIdentified: rootElement.dataset.dateIdentified || null,
    firstReleaseDate: rootElement.dataset.firstReleaseDate || null,
    owned: rootElement.dataset.owned === 'true',
    storeOwned: rootElement.dataset.storeOwned === 'true',
    hltbMain: rootElement.dataset.hltbMain ? Number(rootElement.dataset.hltbMain) : null,
    hltbExtra: rootElement.dataset.hltbExtra ? Number(rootElement.dataset.hltbExtra) : null,
    hltbComplete: rootElement.dataset.hltbComplete
      ? Number(rootElement.dataset.hltbComplete)
      : null,
    sizeLabel: rootElement.dataset.sizeLabel || null,
    libraryUuid: rootElement.dataset.libraryUuid || null,
  }
}
