import { STATUS_OPTIONS, type StatusOption } from './playStatus'
import type { CardGame } from './cardTypes'

/** The play-status dot and its picker (top-right stack). */
export function GameCardStatusControl({
  currentStatus,
  game,
  handleStatusSelect,
  setMenuOpen,
  setStatusOpen,
  showPlayStatus,
  status,
  statusOpen,
  statusPending,
}: {
  currentStatus: StatusOption
  game: CardGame
  handleStatusSelect: (nextStatus: string) => Promise<void>
  setMenuOpen: (open: boolean) => void
  setStatusOpen: (update: boolean | ((open: boolean) => boolean)) => void
  showPlayStatus: boolean
  status: string
  statusOpen: boolean
  statusPending: boolean
}) {
  return (
    <>
      {showPlayStatus && (
        <>
          <button
            type="button"
            className={`game-status-btn${statusPending ? ' processing' : ''}`}
            data-game-uuid={game.uuid}
            data-current-status={status}
            data-chrome-anchor="top-right"
            title={currentStatus.label}
            aria-label={`Game status: ${currentStatus.label}`}
            aria-expanded={statusOpen}
            disabled={statusPending}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setMenuOpen(false)
              setStatusOpen((open) => !open)
            }}
          >
            {statusPending ? (
              <span className="od-spinner od-spinner--sm" aria-hidden="true" />
            ) : (
              <span
                className="od-status-dot"
                style={{
                  background: currentStatus.color,
                  opacity: status ? 1 : 0.4,
                }}
                aria-hidden="true"
              />
            )}
          </button>
          {statusOpen && (
            <div
              className={`status-dropdown${statusOpen ? ' is-open' : ''}`}
              data-game-uuid={game.uuid}
            >
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value || 'clear'}
                  type="button"
                  className={`status-dropdown-option${option.value ? '' : ' is-clear'}`}
                  data-status={option.value}
                  style={{
                    background: 'none',
                    borderLeft: 0,
                    borderRight: 0,
                    borderTop: 0,
                    width: '100%',
                    textAlign: 'left',
                  }}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    handleStatusSelect(option.value)
                  }}
                >
                  <span
                    className="od-status-dot"
                    style={{ background: option.color }}
                    aria-hidden="true"
                  />
                  <span className="status-label">{option.label}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
