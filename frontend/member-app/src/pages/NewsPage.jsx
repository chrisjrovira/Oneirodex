import { useEffect, useState } from 'react'
import { fetchAnnouncements } from '../api/announcements'

export function NewsPage() {
  const [announcements, setAnnouncements] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(null)
    setAnnouncements(null)

    fetchAnnouncements({ signal: controller.signal })
      .then((data) => {
        if (active) {
          setAnnouncements(Array.isArray(data.announcements) ? data.announcements : [])
        }
      })
      .catch((err) => {
        if (active && err.name !== 'AbortError') {
          setError(err)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [retryCount])

  return (
    <div className="gt-more-page gt-news">
      <div className="gt-page-header">
        <h1>News</h1>
      </div>
      <p className="gt-more-page__lede">Announcements from your GameTheca admins.</p>

      {error ? (
        <div role="alert">
          <p>Unable to load news.</p>
          <button type="button" onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      {!error && !announcements ? <p>Loading…</p> : null}

      {!error && announcements && announcements.length === 0 ? (
        <p>No announcements yet.</p>
      ) : null}

      {!error && announcements && announcements.length > 0 ? (
        <ul className="gt-news__list">
          {announcements.map((item) => (
            <li key={item.id} className="gt-news__card">
              <article>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                {item.created_at ? (
                  <time dateTime={item.created_at}>
                    {String(item.created_at).slice(0, 10)}
                  </time>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
