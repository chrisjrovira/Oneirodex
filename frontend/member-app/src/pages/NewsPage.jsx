import { useEffect, useState } from 'react'
import { fetchAnnouncements } from '../api/announcements'
import { fetchGamingNews } from '../api/gamingNews'

export function NewsPage() {
  const [announcements, setAnnouncements] = useState(null)
  const [headlines, setHeadlines] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(null)
    setAnnouncements(null)
    setHeadlines(null)

    Promise.allSettled([
      fetchAnnouncements({ signal: controller.signal }),
      fetchGamingNews({ signal: controller.signal }),
    ]).then(([announceResult, newsResult]) => {
      if (!active) {
        return
      }
      if (announceResult.status === 'fulfilled') {
        const announceData = announceResult.value
        setAnnouncements(
          Array.isArray(announceData.announcements) ? announceData.announcements : [],
        )
      } else if (announceResult.reason?.name !== 'AbortError') {
        setError(announceResult.reason)
        setAnnouncements([])
      }
      if (newsResult.status === 'fulfilled') {
        const newsData = newsResult.value
        setHeadlines(Array.isArray(newsData.items) ? newsData.items : [])
      } else {
        setHeadlines([])
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
      <p className="gt-more-page__lede">
        Admin announcements plus top gaming headlines from the web.
      </p>

      {error ? (
        <div role="alert">
          <p>Unable to load news.</p>
          <button type="button" onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      {!error && !announcements ? <p>Loading…</p> : null}

      {!error && announcements ? (
        <section className="gt-news__section">
          <h2>From your admins</h2>
          {announcements.length === 0 ? <p>No announcements yet.</p> : null}
          {announcements.length > 0 ? (
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
        </section>
      ) : null}

      {!error && headlines ? (
        <section className="gt-news__section">
          <h2>Gaming headlines</h2>
          {headlines.length === 0 ? (
            <p>No external headlines available right now.</p>
          ) : (
            <ul className="gt-news__list">
              {headlines.map((item) => (
                <li key={item.url} className="gt-news__card">
                  <article>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      <strong>{item.title}</strong>
                    </a>
                    {item.summary ? <p>{item.summary}</p> : null}
                    <p className="gt-news__meta">
                      <span>{item.source}</span>
                      {item.published_at ? <time>{String(item.published_at).slice(0, 16)}</time> : null}
                    </p>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}
