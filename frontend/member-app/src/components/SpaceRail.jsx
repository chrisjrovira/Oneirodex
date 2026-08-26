import { useCallback, useEffect, useState } from 'react'
import { csrfHeaders } from '../api/csrf'
import { errorFromBody } from '../api/envelopeError'

/**
 * Space rail — the spaces ("servers") a member belongs to, each expanding into
 * its text and voice channels (W23-SOCIAL-3).
 *
 * Voice rooms come from the server (`channel.room`); the client never invents a
 * room name, because the token endpoint resolves rooms against real membership
 * and denies anything unrecognised.
 */
export function SpaceRail({
  activeChannelId = null,
  onSelectTextChannel,
  onSelectVoiceChannel,
  onJoined,
}) {
  const [spaces, setSpaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [collapsed, setCollapsed] = useState({})
  const [inviteToken, setInviteToken] = useState('')
  const [joinBusy, setJoinBusy] = useState(false)
  const [joinMsg, setJoinMsg] = useState('')

  const loadSpaces = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/chat/spaces', { credentials: 'same-origin' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw errorFromBody(data, response.status, 'Could not load spaces')
      setSpaces(Array.isArray(data.spaces) ? data.spaces : [])
    } catch (err) {
      setError(err.message || 'Could not load spaces')
      setSpaces([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSpaces()
  }, [loadSpaces])

  async function redeemInvite(event) {
    event.preventDefault()
    const token = inviteToken.trim()
    if (!token) return
    setJoinBusy(true)
    setJoinMsg('')
    try {
      const response = await fetch('/api/chat/spaces/join', {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrfHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ token }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw errorFromBody(data, response.status, 'Could not join')
      setInviteToken('')
      setJoinMsg(`Joined ${data.space?.name || 'space'}.`)
      await loadSpaces()
      onJoined?.(data.space)
    } catch (err) {
      setJoinMsg(err.message || 'Could not join')
    } finally {
      setJoinBusy(false)
    }
  }

  function toggleSpace(spaceId) {
    setCollapsed((prev) => ({ ...prev, [spaceId]: !prev[spaceId] }))
  }

  if (loading) {
    return (
      <div className="gt-space-rail" aria-busy="true">
        <p className="gt-space-rail__hint">Loading spaces…</p>
      </div>
    )
  }

  return (
    <nav className="gt-space-rail" aria-label="Spaces">
      {error ? (
        <p className="gt-space-rail__error" role="alert">
          {error}
        </p>
      ) : null}

      {!spaces.length && !error ? (
        <p className="gt-space-rail__hint">
          No spaces yet. An admin can create one, or paste an invite below.
        </p>
      ) : null}

      <ul className="gt-space-rail__list">
        {spaces.map((space) => {
          const isCollapsed = Boolean(collapsed[space.id])
          const textChannels = space.channels || []
          const voiceChannels = space.voice_channels || []
          return (
            <li key={space.id} className="gt-space-rail__space">
              <button
                type="button"
                className="gt-space-rail__space-head"
                aria-expanded={!isCollapsed}
                onClick={() => toggleSpace(space.id)}
              >
                <span className="gt-space-rail__chevron" aria-hidden="true">
                  {isCollapsed ? '▸' : '▾'}
                </span>
                <span className="gt-space-rail__space-name">{space.name}</span>
                {space.visibility === 'invite' ? (
                  <span className="gt-space-rail__tag" title="Invite only">
                    invite
                  </span>
                ) : null}
              </button>

              {!isCollapsed ? (
                <div className="gt-space-rail__body">
                  {textChannels.length ? (
                    <>
                      <p className="gt-space-rail__group">Text</p>
                      <ul className="gt-space-rail__channels">
                        {textChannels.map((channel) => (
                          <li key={channel.id}>
                            <button
                              type="button"
                              className={`gt-space-rail__channel${
                                channel.id === activeChannelId ? ' is-active' : ''
                              }`}
                              aria-current={channel.id === activeChannelId ? 'true' : undefined}
                              onClick={() => onSelectTextChannel?.(channel, space)}
                            >
                              <span aria-hidden="true">#</span> {channel.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}

                  {voiceChannels.length ? (
                    <>
                      <p className="gt-space-rail__group">Voice</p>
                      <ul className="gt-space-rail__channels">
                        {voiceChannels.map((channel) => (
                          <li key={channel.id}>
                            <button
                              type="button"
                              className="gt-space-rail__channel gt-space-rail__channel--voice"
                              onClick={() => onSelectVoiceChannel?.(channel, space)}
                            >
                              <span aria-hidden="true">🔊</span> {channel.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}

                  {!textChannels.length && !voiceChannels.length ? (
                    <p className="gt-space-rail__hint">No channels in this space yet.</p>
                  ) : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      <form className="gt-space-rail__join" onSubmit={redeemInvite}>
        <label className="gt-space-rail__join-label" htmlFor="gt-space-invite">
          Join with invite
        </label>
        <input
          id="gt-space-invite"
          type="text"
          value={inviteToken}
          onChange={(e) => setInviteToken(e.target.value)}
          placeholder="Paste invite code"
          autoComplete="off"
        />
        <button type="submit" className="gt-btn" disabled={joinBusy || !inviteToken.trim()}>
          {joinBusy ? 'Joining…' : 'Join'}
        </button>
        {joinMsg ? (
          <p className="gt-space-rail__hint" role="status">
            {joinMsg}
          </p>
        ) : null}
      </form>
    </nav>
  )
}
