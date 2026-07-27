import { useEffect, useState } from 'react'

function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || ''
}

function partyRoomForGame(gameUuid) {
  const id = (gameUuid || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  return id ? `household:party:${id}` : 'household:lobby'
}

/**
 * Voice lobby — mints LiveKit JWT when ENABLE_LIVEKIT is on.
 * Party mode uses opaque room ids (game UUID), never titles.
 */
export function VoiceLobby({ defaultRoom = 'household:lobby', gameUuid = '', compact = false }) {
  const initialRoom = gameUuid ? partyRoomForGame(gameUuid) : defaultRoom
  const [status, setStatus] = useState(null)
  const [room, setRoom] = useState(initialRoom)
  const [screenshare, setScreenshare] = useState(false)
  const [spectator, setSpectator] = useState(false)
  const [tokenInfo, setTokenInfo] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setRoom(gameUuid ? partyRoomForGame(gameUuid) : defaultRoom)
  }, [gameUuid, defaultRoom])

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
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken(),
        },
        body: JSON.stringify({
          room,
          screenshare: screenshare || undefined,
          spectator: spectator || undefined,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Token failed')
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
      {!compact ? <h2>Voice lobby</h2> : <h3>Party voice</h3>}
      {!compact ? (
        <p className="gt-more-page__lede">
          Household voice via LiveKit SFU. Room ids stay opaque (no game titles in the SFU).
        </p>
      ) : null}
      <label>
        Room
        <input value={room} onChange={(e) => setRoom(e.target.value)} />
      </label>
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
        {busy ? 'Connecting…' : 'Get voice token'}
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
