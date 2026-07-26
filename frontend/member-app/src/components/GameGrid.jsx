import './GameGrid.css'
import { GameCard } from './GameCard'

export function GameGrid({
  games,
  showPlayStatus = false,
  isAdmin = false,
  enableDeleteOnDisk = false,
  discordConfigured = false,
  discordManualTrigger = false,
  onToggleFavorite,
  hidePlatformChip = false,
}) {
  return (
    <div className="game-library-container" data-library-grid>
      {games.map((game) => (
        <GameCard
          key={game.uuid}
          game={game}
          showPlayStatus={showPlayStatus}
          isAdmin={isAdmin}
          enableDeleteOnDisk={enableDeleteOnDisk}
          discordConfigured={discordConfigured}
          discordManualTrigger={discordManualTrigger}
          onToggleFavorite={onToggleFavorite}
          hidePlatformChip={hidePlatformChip}
        />
      ))}
    </div>
  )
}
