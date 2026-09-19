import type { ChatChannel } from './chatTypes'
/** The thread header: room name, mute / archive / leave / voice, expand and close. */
export function ChatThreadHead({
  active,
  archiveActiveRoom,
  expanded,
  leaveActiveRoom,
  onClose,
  onExpandToggle,
  openVoice,
  preferScreenshare,
  roomActionBusy,
  showArchive,
  showLeave,
  toggleMute,
  voiceOpen,
}: {
  active: ChatChannel | null | undefined
  archiveActiveRoom: () => Promise<void>
  expanded: boolean
  leaveActiveRoom: () => Promise<void>
  onClose?: () => void
  onExpandToggle?: () => void
  openVoice: (options?: { screenshare?: boolean }) => void
  preferScreenshare: boolean
  roomActionBusy: boolean
  showArchive: boolean
  showLeave: boolean
  toggleMute: () => Promise<void>
  voiceOpen: boolean
}) {
  return (
    <div className="od-chat-thread__head">
      <div className="od-chat-thread__title">
        {active?.kind === 'dm' || active?.type === 'dm' ? (
          <strong>{active?.name || 'Select a room'}</strong>
        ) : (
          <strong>
            <span aria-hidden="true">#</span>
            {active?.name?.replace(/^#/, '') || 'Select a room'}
          </strong>
        )}
        <span className="od-chat-thread__subtitle">Household room</span>
      </div>
      <div className="od-chat-thread__actions">
        {active ? (
          <>
            <button
              type="button"
              className="od-chat-icon-btn od-chat-icon-btn--accent"
              onClick={() => openVoice({ screenshare: false })}
              aria-pressed={voiceOpen && !preferScreenshare}
              title="Join household voice"
            >
              Voice
            </button>
            <button
              type="button"
              className="od-chat-icon-btn od-chat-icon-btn--accent"
              onClick={() => openVoice({ screenshare: true })}
              aria-pressed={voiceOpen && preferScreenshare}
              title="Request screenshare (may be blocked for child accounts)"
            >
              Screenshare
            </button>
            <button
              type="button"
              className="od-chat-icon-btn"
              onClick={() => void toggleMute()}
              aria-pressed={Boolean(active.muted)}
              disabled={roomActionBusy}
            >
              {active.muted ? 'Unmute' : 'Mute'}
            </button>
          </>
        ) : null}
        {showLeave ? (
          <button
            type="button"
            className="od-chat-icon-btn"
            onClick={() => void leaveActiveRoom()}
            disabled={roomActionBusy}
          >
            Leave
          </button>
        ) : null}
        {showArchive ? (
          <button
            type="button"
            className="od-chat-icon-btn"
            onClick={() => void archiveActiveRoom()}
            disabled={roomActionBusy}
          >
            Archive
          </button>
        ) : null}
        {typeof onExpandToggle === 'function' ? (
          <button
            type="button"
            className="od-chat-icon-btn"
            onClick={onExpandToggle}
            aria-pressed={expanded}
            title={expanded ? 'Compact chat panel' : 'Expand chat panel'}
          >
            {expanded ? 'Compact' : 'Expand'}
          </button>
        ) : null}
        {onClose ? (
          <button
            type="button"
            className="od-chat-icon-btn"
            aria-label="Close chat"
            onClick={onClose}
          >
            ×
          </button>
        ) : null}
      </div>
    </div>
  )
}
