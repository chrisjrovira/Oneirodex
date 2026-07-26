import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

async function fetchActivity({ signal } = {}) {
  const response = await fetch('/api/activity', {
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

export function ActivityPage() {
  const [data, setData] = useState(null)
  const [social, setSocial] = useState(null)
  const [friends, setFriends] = useState([])
  const [friendName, setFriendName] = useState('')
  const [error, setError] = useState(null)
  const [friendMsg, setFriendMsg] = useState(null)

  function reload() {
    const controller = new AbortController()
    Promise.all([
      fetchActivity({ signal: controller.signal }),
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
    const timer = window.setInterval(() => {
      fetchActivity()
        .then(setData)
        .catch(() => {})
      fetchSocial()
        .then(setSocial)
        .catch(() => {})
    }, 30000)
    return () => {
      cleanup?.()
      window.clearInterval(timer)
    }
  }, [])

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
      setFriendMsg(body.existing ? 'Already connected or pending' : 'Friend request sent')
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

  return (
    <div className="gt-more-page">
      <div className="gt-page-header">
        <h1>Activity</h1>
      </div>
      <p className="gt-more-page__lede">
        Now playing and recent sessions across the library. Polls every 30s.
      </p>
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
      {error ? (
        <p role="alert">Unable to load activity.</p>
      ) : !data ? (
        <p>Loading…</p>
      ) : data.restricted ? (
        <p>Activity feed is limited for this account.</p>
      ) : (
        <>
          <section>
            <h2>Now playing</h2>
            {(data.now_playing || []).length === 0 ? (
              <p className="gt-more-page__lede">Nobody is playing right now.</p>
            ) : (
              <ul>
                {data.now_playing.map((row) => (
                  <li key={`np-${row.session_id}`}>
                    <strong>{row.user}</strong> —{' '}
                    <Link to={`/game_details/${row.game_uuid}`}>{row.game_name}</Link>
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
                  <strong>{row.user}</strong> played{' '}
                  <Link to={`/game_details/${row.game_uuid}`}>{row.game_name}</Link>
                  {row.is_playing ? ' (live)' : ''}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2>Friends</h2>
            <form className="gt-updates__search-form" onSubmit={requestFriend}>
              <label>
                Add by username
                <input value={friendName} onChange={(e) => setFriendName(e.target.value)} />
              </label>
              <button className="gt-btn" type="submit">
                Request
              </button>
            </form>
            {friendMsg ? <p>{friendMsg}</p> : null}
            <ul>
              {friends.map((row) => (
                <li key={row.id}>
                  <strong>{row.user?.name}</strong> — {row.status}
                  {row.direction === 'incoming' && row.status === 'pending' ? (
                    <>
                      {' '}
                      <button type="button" className="gt-btn" onClick={() => void acceptFriend(row.id)}>
                        Accept
                      </button>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
