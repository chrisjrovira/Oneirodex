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

export function ActivityPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchActivity({ signal: controller.signal })
      .then(setData)
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err)
      })
    return () => controller.abort()
  }, [])

  return (
    <div className="gt-more-page">
      <div className="gt-page-header">
        <h1>Activity</h1>
      </div>
      <p className="gt-more-page__lede">
        Now playing and recent sessions across the library (single-server social cue).
      </p>
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
        </>
      )}
    </div>
  )
}
