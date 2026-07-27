import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m`
  return `${seconds}s`
}

export function MemberProfilePage() {
  const { userId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/users/${userId}/profile`, {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Profile ${response.status}`)
        return response.json()
      })
      .then(setData)
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err)
      })
    return () => controller.abort()
  }, [userId])

  if (error) {
    return (
      <div className="gt-more-page">
        <p role="alert">Unable to load profile.</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="gt-more-page">
        <p>Loading…</p>
      </div>
    )
  }

  const user = data.user || {}
  const presence = data.presence || {}

  return (
    <div className="gt-more-page">
      <div className="gt-page-header">
        <h1>{user.name}</h1>
      </div>
      <p className="gt-more-page__lede">
        {presence.status === 'in-game' && presence.game_name
          ? `Playing ${presence.game_name}`
          : presence.status || 'offline'}
        {' · '}
        {formatDuration(data.total_seconds)} total
        {data.is_friend ? ' · Friend' : ''}
        {data.is_self ? ' · You' : ''}
      </p>
      {user.about ? <p>{user.about}</p> : null}
      <section>
        <h2>Recent games</h2>
        {(data.recent_games || []).length === 0 ? (
          <p className="gt-more-page__lede">No recent games visible to you.</p>
        ) : (
          <ul>
            {data.recent_games.map((row) => (
              <li key={row.game_uuid}>
                <Link to={`/game_details/${row.game_uuid}`}>{row.game_name}</Link>
                {' — '}
                {formatDuration(row.total_seconds)}
              </li>
            ))}
          </ul>
        )}
      </section>
      <p>
        <Link to="/activity">Back to Activity</Link>
      </p>
    </div>
  )
}
