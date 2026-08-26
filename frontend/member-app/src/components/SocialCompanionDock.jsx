import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { csrfHeaders } from '../api/csrf'
import { errorFromBody } from '../api/envelopeError'
import { requestOpenChatPanel } from '../hooks/chatPanelApi'
import {
  mintPartyToken,
  OPEN_SOCIAL_EVENT,
  openDirectMessage,
  openSocialPopoutWindow,
  partyInvitePath,
  presenceLabel,
  readCompanionOpen,
  readCompanionPinned,
  shareGamePath,
  writeCompanionOpen,
  writeCompanionPinned,
} from '../hooks/socialCompanionApi'
import { useSocialCompanion } from '../hooks/useSocialCompanion'
import { showToast } from '../utils/toast'
import { PageStatus } from './PageStatus'
import './SocialCompanionDock.css'

function FriendRow({
  row,
  gameUuid,
  onMessage,
  onInvite,
  onShare,
  busyKey,
}) {
  const user = row.user || {}
  const presence = user.presence || {}
  const status = presence.status || 'offline'
  const key = String(user.id || row.id)

  return (
    <li className={`gt-social-dock__friend gt-social-dock__friend--${status}`}>
      <div className="gt-social-dock__friend-main">
        <span className={`gt-social-dock__dot gt-social-dock__dot--${status}`} aria-hidden="true" />
        <div className="gt-social-dock__friend-text">
          {user.id ? (
            <Link className="gt-social-dock__name" to={`/members/${user.id}`}>
              {user.name || 'Friend'}
            </Link>
          ) : (
            <strong className="gt-social-dock__name">{user.name || 'Friend'}</strong>
          )}
          <span className="gt-social-dock__presence">
            {presenceLabel(status)}
            {presence.game_name ? ` · ${presence.game_name}` : ''}
          </span>
        </div>
      </div>
      <div className="gt-social-dock__friend-actions">
        <button
          type="button"
          className="gt-social-dock__mini"
          disabled={busyKey === `dm-${key}`}
          onClick={() => onMessage(user)}
          title="Direct message"
        >
          DM
        </button>
        <button
          type="button"
          className="gt-social-dock__mini"
          disabled={busyKey === `invite-${key}`}
          onClick={() => onInvite(user)}
          title="Invite to party voice"
        >
          Party
        </button>
        {gameUuid ? (
          <button
            type="button"
            className="gt-social-dock__mini"
            disabled={busyKey === `share-${key}`}
            onClick={() => onShare(user)}
            title="Share focused game"
          >
            Share
          </button>
        ) : null}
        {presence.game_uuid ? (
          <Link className="gt-social-dock__mini" to={shareGamePath(presence.game_uuid)} title="Open what they’re playing">
            Join
          </Link>
        ) : null}
      </div>
    </li>
  )
}

/**
 * Stay-open friends companion — dock in library/Big Picture, or full panel on /social-companion.
 */
export function SocialCompanionDock({
  mode = 'dock',
  gameUuid = '',
  defaultOpen,
  forceOpen = false,
  hideLauncher = false,
  open: openProp,
  onOpenChange,
}) {
  const standalone = mode === 'standalone' || mode === 'popout'
  const bigPicture = mode === 'big-picture'
  const controlled = typeof openProp === 'boolean'
  const [uncontrolledOpen, setUncontrolledOpen] = useState(() => {
    if (forceOpen || standalone) return true
    if (typeof defaultOpen === 'boolean') return defaultOpen
    return readCompanionOpen(false)
  })
  const open = controlled ? openProp : uncontrolledOpen

  function setOpen(next) {
    const value = typeof next === 'function' ? next(open) : next
    if (!controlled) setUncontrolledOpen(value)
    onOpenChange?.(value)
  }
  const [pinned, setPinned] = useState(() => readCompanionPinned(true))
  const [busyKey, setBusyKey] = useState(null)
  const [toast, setToast] = useState(null)
  const [addName, setAddName] = useState('')
  // SSE only while the companion is open — closed dock must not hold
  // /api/activity/stream (single-worker uvicorn + sync SSE starved the SPA).
  const social = useSocialCompanion({ enabled: true, sseEnabled: open || standalone })

  useEffect(() => {
    if (standalone || forceOpen || controlled) return undefined
    writeCompanionOpen(open)
  }, [open, standalone, forceOpen, controlled])

  useEffect(() => {
    writeCompanionPinned(pinned)
  }, [pinned])

  useEffect(() => {
    if (!bigPicture) return undefined
    function onKey(event) {
      if (event.key === 'y' || event.key === 'Y') {
        if (event.target?.closest?.('input, textarea, select, [contenteditable]')) return
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bigPicture])

  useEffect(() => {
    if (standalone) return undefined
    function onOpenRequest() {
      setOpen(true)
    }
    window.addEventListener(OPEN_SOCIAL_EVENT, onOpenRequest)
    return () => window.removeEventListener(OPEN_SOCIAL_EVENT, onOpenRequest)
  }, [standalone])

  function notify(message, tone = 'info') {
    setToast(message)
    showToast(message, tone)
  }

  async function handleMessage(user) {
    const key = `dm-${user.id}`
    setBusyKey(key)
    try {
      const data = await openDirectMessage({ userId: user.id, username: user.name })
      notify(`DM ready with ${user.name}`)
      const channelId = data?.channel?.id
      if (standalone) {
        window.location.href = '/chat'
      } else {
        requestOpenChatPanel(channelId != null ? { channelId } : {})
      }
    } catch (err) {
      notify(err.message || 'DM failed', 'error')
    } finally {
      setBusyKey(null)
    }
  }

  async function handleInvite(user) {
    const key = `invite-${user.id}`
    setBusyKey(key)
    try {
      const token = await mintPartyToken({ gameUuid })
      const path = partyInvitePath(gameUuid)
      const absolute = `${window.location.origin}${path}`
      try {
        await navigator.clipboard.writeText(absolute)
        notify(`Party invite copied for ${user.name} (${token.room})`)
      } catch {
        notify(`Party room ready: ${token.room}. Open Activity to join voice.`)
      }
    } catch (err) {
      notify(err.message || 'Party invite unavailable — enable LiveKit or open Activity.', 'warn')
    } finally {
      setBusyKey(null)
    }
  }

  async function handleShare() {
    if (!gameUuid) {
      notify('Focus a game first to share.', 'warn')
      return
    }
    const path = shareGamePath(gameUuid)
    const absolute = `${window.location.origin}${path}`
    try {
      await navigator.clipboard.writeText(absolute)
      notify('Game link copied — paste into chat or DM')
    } catch {
      notify(`Share link: ${path}`)
    }
  }

  async function handleAddFriend(event) {
    event.preventDefault()
    const username = addName.trim()
    if (!username) return
    setBusyKey('add')
    try {
      const response = await fetch('/api/social/friends', {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ username }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw errorFromBody(data, response.status, 'Request failed')
      setAddName('')
      notify(data.sent ? 'Friend request sent' : data.message || 'Request sent')
      await social.reload()
    } catch (err) {
      notify(err.message || 'Could not add friend', 'error')
    } finally {
      setBusyKey(null)
    }
  }

  const panel = (
    <aside
      className={`gt-social-dock gt-glass-panel gt-social-dock--${mode}${open ? ' is-open' : ''}${pinned ? ' is-pinned' : ''}`}
      aria-label="Friends companion"
    >
      <header className="gt-social-dock__header">
        <div>
          <h2 className="gt-social-dock__title">Friends</h2>
          <p className="gt-social-dock__sub">
            {social.onlineCount} online
            {social.pendingCount ? ` · ${social.pendingCount} pending` : ''}
          </p>
        </div>
        <div className="gt-social-dock__header-actions">
          {!standalone ? (
            <button
              type="button"
              className="gt-social-dock__icon-btn"
              aria-pressed={pinned}
              title={pinned ? 'Unpin (can auto-collapse)' : 'Pin open'}
              onClick={() => setPinned((value) => !value)}
            >
              {pinned ? 'Pinned' : 'Pin'}
            </button>
          ) : null}
          {!standalone ? (
            <button
              type="button"
              className="gt-social-dock__icon-btn"
              title="Pop out stay-open window"
              onClick={() => openSocialPopoutWindow()}
            >
              Pop out
            </button>
          ) : null}
          {!standalone && !forceOpen ? (
            <button
              type="button"
              className="gt-social-dock__icon-btn"
              aria-label="Hide friends"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          ) : null}
        </div>
      </header>

      {social.error ? (
        <p className="gt-social-dock__empty" role="alert">
          Unable to load friends.
        </p>
      ) : null}

      {social.pendingIncoming.length > 0 ? (
        <section className="gt-social-dock__section">
          <h3>Requests</h3>
          <ul className="gt-social-dock__list">
            {social.pendingIncoming.map((row) => (
              <li key={`pending-${row.id}`} className="gt-social-dock__friend">
                <div className="gt-social-dock__friend-main">
                  <strong>{row.user?.name || 'Someone'}</strong>
                </div>
                <div className="gt-social-dock__friend-actions">
                  <button
                    type="button"
                    className="gt-social-dock__mini"
                    onClick={() => {
                      void fetch(`/api/social/friends/${row.id}/accept`, {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: csrfHeaders(),
                      }).then(() => social.reload())
                    }}
                  >
                    Accept
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="gt-social-dock__section gt-social-dock__section--grow">
        <h3>Household</h3>
        {social.loading && social.accepted.length === 0 ? (
          <PageStatus loading className="gt-social-dock__empty" />
        ) : social.accepted.length === 0 ? (
          <p className="gt-social-dock__empty">No friends yet — add someone below.</p>
        ) : (
          <ul className="gt-social-dock__list">
            {social.accepted.map((row) => (
              <FriendRow
                key={row.id}
                row={row}
                gameUuid={gameUuid}
                busyKey={busyKey}
                onMessage={handleMessage}
                onInvite={handleInvite}
                onShare={handleShare}
              />
            ))}
          </ul>
        )}
      </section>

      {social.nowPlaying.length > 0 ? (
        <section className="gt-social-dock__section">
          <h3>Now playing</h3>
          <ul className="gt-social-dock__now">
            {social.nowPlaying.slice(0, 6).map((row) => (
              <li key={`np-${row.session_id || row.user_id}-${row.game_uuid}`}>
                <strong>{row.user}</strong>
                {' — '}
                <Link to={shareGamePath(row.game_uuid)}>{row.game_name}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form className="gt-social-dock__add" onSubmit={handleAddFriend}>
        <input
          value={addName}
          onChange={(event) => setAddName(event.target.value)}
          placeholder="Add friend username"
          autoComplete="off"
          aria-label="Add friend by username"
        />
        <button type="submit" className="gt-btn" disabled={busyKey === 'add'}>
          Add
        </button>
      </form>

      <footer className="gt-social-dock__footer">
        <button
          type="button"
          className="gt-social-dock__footer-link"
          onClick={() => {
            if (standalone) {
              window.location.href = '/chat'
            } else {
              requestOpenChatPanel()
            }
          }}
        >
          Chat
        </button>
        <Link className="gt-social-dock__footer-link" to="/activity">
          Activity
        </Link>
        {gameUuid ? (
          <button type="button" className="gt-social-dock__footer-link" onClick={() => void handleShare()}>
            Copy game
          </button>
        ) : null}
        {toast ? <span className="gt-social-dock__toast">{toast}</span> : null}
      </footer>
    </aside>
  )

  if (standalone) {
    return <div className="gt-social-companion-page">{panel}</div>
  }

  return (
    <>
      {!hideLauncher && !open ? (
        <button
          type="button"
          className={`gt-social-dock__launcher${bigPicture ? ' gt-social-dock__launcher--bp' : ''}`}
          onClick={() => setOpen(true)}
          title={bigPicture ? 'Friends (Y)' : 'Friends companion'}
          aria-label="Open friends companion"
        >
          Friends
          {social.onlineCount > 0 ? <span className="gt-social-dock__badge">{social.onlineCount}</span> : null}
          {social.pendingCount > 0 ? (
            <span className="gt-social-dock__badge gt-social-dock__badge--pending">{social.pendingCount}</span>
          ) : null}
        </button>
      ) : null}
      {open ? panel : null}
    </>
  )
}
