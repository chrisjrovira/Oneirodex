import { useEffect, useState } from 'react'
import { csrfHeaders } from '../api/csrf'
import { errorFromBody } from '../api/envelopeError'

function partyRoomForGame(gameUuid) {
  const id = (gameUuid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  return id ? `household:party:${id}` : 'household:lobby'
}

/**
 * Voice lobby — mints LiveKit JWT when ENABLE_LIVEKIT is on.
 *
 * The room is **always** derived from context (a voice channel, a game party,
 * or the household lobby) — never typed by the user. The server resolves every
 * room name to real membership and denies anything it does not recognise, so a
 * free-text box would only ever produce 403s and invite room-guessing.
 */
export function VoiceLobby({
  defaultRoom = 'household:lobby',
  gameUuid = '',
  room: fixedRoom = '',
  compact = false,
  defaultScreenshare = false,
  roomLabel = '',
}) {
  const initialRoom = fixedRoom || (gameUuid ? partyRoomForGame(gameUuid) : defaultRoom)
  const [status, setStatus] = useState(null)
  const [room, setRoom] = useState(initialRoom)
  const [screenshare, setScreenshare] = useState(Boolean(defaultScreenshare))
  const [spectator, setSpectator] = useState(false)
  const [tokenInfo, setTokenInfo] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setRoom(fixedRoom || (gameUuid ? partyRoomForGame(gameUuid) : defaultRoom))
  }, [fixedRoom, gameUuid, defaultRoom])

  useEffect(() => {
    setScreenshare(Boolean(defaultScreenshare))
  }, [defaultScreenshare])

  useEffect(() => {
    fetch('/api/rtc/status', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ enabled: false }))
  }, [])

  async function joinLobby() {
    setBusy(true)
    setError(null)
    setTokenInfo(null)
    try {
      const response = await fetch('/api/rtc/token', {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          room,
          screenshare: screenshare || undefined,
          spectator: spectator || undefined,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw errorFromBody(data, response.status, 'Token failed')
      setTokenInfo(data)
    } catch (err) {
      setError(err.message || 'Join failed')
    } finally {
      setBusy(false)
    }
  }

  if (!status) return null
  if (!status.enabled) {
    if (compact) return null
    return (
      <section>
        <h2>Voice lobby</h2>
        <p className="gt-more-page__lede">
          Voice is on by default. If tokens fail, set LIVEKIT_URL / API key/secret and run the compose
          `livekit` profile. Chat and friends work without it.
        </p>
      </section>
    )
  }

  return (
    <section className={compact ? 'gt-voice-lobby gt-voice-lobby--compact' : 'gt-voice-lobby'}>
      {!compact ? <h2>Voice lobby</h2> : <h3>{roomLabel || 'Party voice'}</h3>}
      {!compact ? (
        <p className="gt-more-page__lede">
          Household voice via LiveKit SFU. Room ids stay opaque (no game titles in the SFU).
        </p>
      ) : (
        <p className="gt-voice-lobby__hint">
          Voice &amp; screenshare use LiveKit. Child accounts: audio OK; camera/screenshare may be
          blocked by the server.
        </p>
      )}
      <p className="gt-voice-lobby__room">
        Room: <code>{roomLabel || room}</code>
      </p>
      <label>
        <input
          type="checkbox"
          checked={screenshare}
          onChange={(e) => setScreenshare(e.target.checked)}
        />
        {' '}
        Request screenshare (blocked for child accounts)
      </label>
      <label>
        <input
          type="checkbox"
          checked={spectator}
          onChange={(e) => {
            setSpectator(e.target.checked)
            if (e.target.checked) setScreenshare(false)
          }}
        />
        {' '}
        Spectator (listen only — no mic/camera publish)
      </label>
      <button type="button" className="gt-btn" disabled={busy} onClick={() => void joinLobby()}>
        {busy ? 'Connecting…' : screenshare ? 'Get voice + screenshare token' : 'Get voice token'}
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {tokenInfo ? (
        <p>
          Token ready for room <code>{tokenInfo.room}</code> at <code>{tokenInfo.url}</code>.
          Connect with a LiveKit client using this short-lived JWT (not shown).
        </p>
      ) : null}
    </section>
  )
}
