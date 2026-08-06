import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageStatus } from '../components/PageStatus'
import { VoiceLobby } from '../components/VoiceLobby'
import '../styles/panelGrid.css'

async function fetchActivity({ signal, friendsOnly } = {}) {
  const qs = friendsOnly ? '?friends_only=1' : ''
  const response = await fetch(`/api/activity${qs}`, {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) {
    throw new Error(`Activity ${response.status}`)
  }
  return response.json()
}

async function fetchSocial({ signal } = {}) {
  const response = await fetch('/api/social/status', {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) {
    return null
  }
  return response.json()
}

async function fetchFriends({ signal } = {}) {
  const response = await fetch('/api/social/friends', {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) {
    return { friends: [] }
  }
  return response.json()
}

function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || ''
}

function presenceLabel(status) {
  if (status === 'in-game') return 'In game'
  if (status === 'online') return 'Online'
  if (status === 'away') return 'Away'
  return 'Offline'
}

export function ActivityPage() {
  const [data, setData] = useState(null)
  const [social, setSocial] = useState(null)
  const [friends, setFriends] = useState([])
  const [friendName, setFriendName] = useState('')
  const [error, setError] = useState(null)
  const [friendMsg, setFriendMsg] = useState(null)
  const [friendsOnly, setFriendsOnly] = useState(false)

  function reload() {
    const controller = new AbortController()
    Promise.all([
      fetchActivity({ signal: controller.signal, friendsOnly }),
      fetchSocial({ signal: controller.signal }),
      fetchFriends({ signal: controller.signal }),
    ])
      .then(([activity, socialStatus, friendData]) => {
        setData(activity)
        setSocial(socialStatus)
        setFriends(Array.isArray(friendData?.friends) ? friendData.friends : [])
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err)
      })
    return () => controller.abort()
  }

  useEffect(() => {
    const cleanup = reload()
    let source
    let sseLive = false
    let timer = 0

    function pollFallback() {
      fetchActivity({ friendsOnly })
        .then(setData)
        .catch(() => {})
      fetchSocial()
        .then(setSocial)
        .catch(() => {})
    }

    function startSlowPoll() {
      window.clearInterval(timer)
      // SSE healthy: rare safety poll. SSE dead: 30s fallback.
      const ms = sseLive ? 120000 : 30000
      timer = window.setInterval(pollFallback, ms)
    }

    let sseTimer = 0

    function connectSse() {
      try {
        source = new EventSource('/api/activity/stream')
        source.addEventListener('hello', () => {
          sseLive = true
          startSlowPoll()
        })
        source.addEventListener('activity', () => {
          sseLive = true
          fetchActivity({ friendsOnly }).then(setData).catch(() => {})
          fetchSocial().then(setSocial).catch(() => {})
        })
        source.addEventListener('presence', () => {
          sseLive = true
          fetchSocial().then(setSocial).catch(() => {})
          fetchFriends().then((friendData) => {
            setFriends(Array.isArray(friendData?.friends) ? friendData.friends : [])
          }).catch(() => {})
        })
        source.onerror = () => {
          sseLive = false
          startSlowPoll()
        }
      } catch {
        source = null
        sseLive = false
      }
    }

    // Poll first; defer SSE so initial Activity fetches aren't racing the stream.
    startSlowPoll()
    sseTimer = window.setTimeout(connectSse, 500)
    return () => {
      cleanup?.()
      window.clearInterval(timer)
      window.clearTimeout(sseTimer)
      source?.close()
    }
  }, [friendsOnly])

  async function requestFriend(event) {
    event.preventDefault()
    const username = friendName.trim()
    if (!username) return
    setFriendMsg(null)
    try {
      const response = await fetch('/api/social/friends', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken(),
        },
        body: JSON.stringify({ username }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Request failed')
      setFriendName('')
      if (body.existing) {
        setFriendMsg('Already connected or pending')
      } else if (body.sent) {
        setFriendMsg('Friend request sent')
      } else {
        setFriendMsg(body.message || 'If that username exists, a friend request was sent.')
      }
      const friendData = await fetchFriends()
      setFriends(Array.isArray(friendData?.friends) ? friendData.friends : [])
    } catch (err) {
      setFriendMsg(err.message || 'Friend request failed')
    }
  }

  async function acceptFriend(id) {
    await fetch(`/api/social/friends/${id}/accept`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': csrfToken() },
    })
    const friendData = await fetchFriends()
    setFriends(Array.isArray(friendData?.friends) ? friendData.friends : [])
  }

  async function rejectFriend(id) {
    await fetch(`/api/social/friends/${id}/reject`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': csrfToken() },
    })
    const friendData = await fetchFriends()
    setFriends(Array.isArray(friendData?.friends) ? friendData.friends : [])
  }

  async function removeFriend(id) {
    await fetch(`/api/social/friends/${id}`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': csrfToken() },
    })
    const friendData = await fetchFriends()
    setFriends(Array.isArray(friendData?.friends) ? friendData.friends : [])
  }

  return (
    <div className="gt-more-page gt-panels">
      <div className="gt-page-header gt-panels__full">
        <h1>Activity</h1>
      </div>
      <p className="gt-more-page__lede">
        Friends, presence, and who’s playing — social hangout is on by default for the household.
      </p>
      <label className="gt-more-page__lede">
        <input
          type="checkbox"
          checked={friendsOnly}
          onChange={(event) => setFriendsOnly(event.target.checked)}
        />{' '}
        Friends only feed
      </label>
      {social?.community_chat_url ? (
        <p>
          <a
            className="gt-btn"
            href={social.community_chat_url}
            target="_blank"
            rel="noopener noreferrer"
            title={social.community_chat_url}
          >
            {social.community_chat_label || 'Open community'}
          </a>
        </p>
      ) : null}

      <section>
        <h2>Friends</h2>
        <form className="gt-updates__search-form" onSubmit={requestFriend}>
          <label>
            Add by username
            <input
              value={friendName}
              onChange={(e) => setFriendName(e.target.value)}
              placeholder="household username"
              autoComplete="off"
            />
          </label>
          <button className="gt-btn" type="submit">
            Request
          </button>
        </form>
        {friendMsg ? <p role="status">{friendMsg}</p> : null}
        {friends.length === 0 ? (
          <PageStatus emptyMessage="No friends yet — add someone by username." />
        ) : (
          <ul>
            {friends.map((row) => (
              <li key={row.id}>
                <Link to={`/members/${row.user?.id}`}>
                  <strong>{row.user?.name}</strong>
                </Link>{' '}
                — {row.status}
                {row.user?.presence?.status
                  ? ` · ${presenceLabel(row.user.presence.status)}`
                  : ''}
                {row.direction === 'incoming' && row.status === 'pending' ? (
                  <>
                    {' '}
                    <button type="button" className="gt-btn" onClick={() => void acceptFriend(row.id)}>
                      Accept
                    </button>{' '}
                    <button type="button" className="gt-btn" onClick={() => void rejectFriend(row.id)}>
                      Decline
                    </button>
                  </>
                ) : null}
                {row.status === 'accepted' ? (
                  <>
                    {' '}
                    <button type="button" className="gt-btn" onClick={() => void removeFriend(row.id)}>
                      Unfriend
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <VoiceLobby />
      {error ? (
        <p role="alert">Unable to load activity.</p>
      ) : !data ? (
        <PageStatus loading loadingMessage="Loading activity…" />
      ) : data.restricted ? (
        <p>Activity feed is limited for this account.</p>
      ) : (
        <>
          <section>
            <h2>Now playing</h2>
            {(data.now_playing || []).length === 0 ? (
              <PageStatus emptyMessage="Nobody is playing right now." />
            ) : (
              <ul>
                {data.now_playing.map((row) => (
                  <li key={`np-${row.session_id}`}>
                    {row.user_id ? (
                      <Link to={`/members/${row.user_id}`}>
                        <strong>{row.user}</strong>
                      </Link>
                    ) : (
                      <strong>{row.user}</strong>
                    )}{' '}
                    — <Link to={`/game_details/${row.game_uuid}`}>{row.game_name}</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2>Recent</h2>
            <ul>
              {(data.activity || []).map((row) => (
                <li key={row.session_id}>
                  {row.user_id ? (
                    <Link to={`/members/${row.user_id}`}>
                      <strong>{row.user}</strong>
                    </Link>
                  ) : (
                    <strong>{row.user}</strong>
                  )}{' '}
                  played <Link to={`/game_details/${row.game_uuid}`}>{row.game_name}</Link>
                  {row.is_playing ? ' (live)' : ''}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
