import type { DetailsGame, PathModalRequest, PathRow } from './detailsTypes'
import { AnticheatFact } from './AnticheatFact'
import { formatPlaytime, TaxonomyChip } from './detailsHelpers'
import { SavePathsFact } from './SavePathsFact'
import { Button } from '@oneirodex/ui'

/** The Details facts grid: taxonomy chips, playtime, admin paths. */
export function DetailsFactsSection({
  game,
  pathRows,
  setPathModal,
}: {
  game: DetailsGame
  pathRows: PathRow[]
  setPathModal: (request: PathModalRequest | null) => void
}) {
  return (
    <section className="od-details-page__section od-details-page__section--facts">
      <h2 className="od-details-page__section-head">
        <span>Details</span>
        {pathRows.length > 0 ? (
          <span className="od-details-page__section-actions">
            {pathRows.map((row) => (
              <Button
                key={`open-${row.label}-${row.path}`}
                type="button"
                size="sm"
                pill
                onClick={() => setPathModal(row)}
              >
                {pathRows.length > 1 ? `Open ${row.label.toLowerCase()}` : 'Open path'}
              </Button>
            ))}
          </span>
        ) : null}
      </h2>
      {pathRows.length > 0 ? (
        <div className="od-details-page__paths" aria-label="Admin paths">
          {pathRows.map((row) => (
            <div key={`${row.label}-${row.path}`} className="od-details-page__path-row">
              <span className="od-details-page__path-label">{row.label}</span>
              <code className="od-details-page__path-value" title={row.path}>
                {row.path}
              </code>
            </div>
          ))}
        </div>
      ) : null}
      <dl className="od-details-page__facts">
        {game.rating != null ? (
          <>
            <dt>Rating</dt>
            <dd>
              {Number(game.rating).toFixed(0)}
              {game.rating_count ? ` (${game.rating_count})` : ''}
            </dd>
          </>
        ) : null}
        {game.genres?.length ? (
          <>
            <dt>Genres</dt>
            <dd>
              {game.genres.map((name: any) => (
                <TaxonomyChip key={name} kind="genre" name={name} />
              ))}
            </dd>
          </>
        ) : null}
        {game.themes?.length ? (
          <>
            <dt>Themes</dt>
            <dd>
              {game.themes.map((name: any) => (
                <TaxonomyChip key={name} kind="theme" name={name} />
              ))}
            </dd>
          </>
        ) : null}
        {game.platforms?.length ? (
          <>
            <dt>IGDB platforms</dt>
            <dd>{game.platforms.join(', ')}</dd>
          </>
        ) : null}
        {game.game_modes?.length ? (
          <>
            <dt>Modes</dt>
            <dd>
              {game.game_modes.map((name: any) => (
                <TaxonomyChip key={name} kind="game_mode" name={name} />
              ))}
            </dd>
          </>
        ) : null}
        {game.player_perspectives?.length ? (
          <>
            <dt>Perspectives</dt>
            <dd>
              {game.player_perspectives.map((name: any) => (
                <TaxonomyChip key={name} kind="player_perspective" name={name} />
              ))}
            </dd>
          </>
        ) : null}
        {game.anticheat?.status ? (
          <>
            <dt>Anti-cheat</dt>
            <dd>
              <AnticheatFact report={game.anticheat} />
            </dd>
          </>
        ) : null}
        {game.save_paths && game.save_paths.length ? (
          <>
            <dt>Save location</dt>
            <dd>
              <SavePathsFact
                paths={game.save_paths}
                canOpen={Boolean(game.client_connected)}
                onOpen={(path) => setPathModal({ label: 'Save folder', path })}
              />
            </dd>
          </>
        ) : null}
        <dt>Playtime</dt>
        <dd>
          {formatPlaytime(game.playtime?.total_seconds)}
          {game.playtime?.session_count
            ? ` · ${game.playtime.session_count} session${game.playtime.session_count === 1 ? '' : 's'}`
            : ''}
        </dd>
        {game.times_downloaded != null ? (
          <>
            <dt>Downloads</dt>
            <dd>{game.times_downloaded}</dd>
          </>
        ) : null}
      </dl>
    </section>
  )
}
