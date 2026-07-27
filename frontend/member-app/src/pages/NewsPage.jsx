import { useEffect, useState } from 'react'
import { fetchAnnouncements } from '../api/announcements'
import { claimFreeGameAssist, fetchFreeGames } from '../api/freeGames'
import { fetchGamingNews } from '../api/gamingNews'
import './NewsPage.css'

function formatEndsAt(value) {
  if (!value) {
    return null
  }
  const text = String(value)
  return text.length >= 10 ? text.slice(0, 10) : text
}

function storeLabel(store) {
  const map = {
    steam: 'Steam',
    epic: 'Epic',
    gog: 'GOG',
    amazon: 'Amazon',
    itch: 'itch.io',
    humble: 'Humble',
    other: 'Store',
  }
  return map[store] || store || 'Store'
}

export function NewsPage() {
  const [announcements, setAnnouncements] = useState(null)
  const [freeGames, setFreeGames] = useState(null)
  const [headlines, setHeadlines] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [assistMsg, setAssistMsg] = useState({})

  async function claimAssist(item) {
    if (!item?.id) {
      return
    }
    try {
      const result = await claimFreeGameAssist(item.id)
      setAssistMsg((prev) => ({
        ...prev,
        [item.id]: result.message || (result.ok ? 'Ownership updated.' : result.error || 'Failed'),
      }))
      // Prefer opening the claim page after registering intent
      const href = result.links?.protocol || result.links?.https || item.links?.https
      if (href && result.ok) {
        window.open(href, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      setAssistMsg((prev) => ({
        ...prev,
        [item.id]: err?.message || 'Claim assist failed',
      }))
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(null)
    setAnnouncements(null)
    setFreeGames(null)
    setHeadlines(null)

    Promise.allSettled([
      fetchAnnouncements({ signal: controller.signal }),
      fetchFreeGames({ signal: controller.signal }),
      fetchGamingNews({ signal: controller.signal }),
    ]).then(([announceResult, freeResult, newsResult]) => {
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
      if (freeResult.status === 'fulfilled') {
        const freeData = freeResult.value
        setFreeGames(Array.isArray(freeData.items) ? freeData.items : [])
      } else {
        setFreeGames([])
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
        Admin announcements, free store claims, and gaming headlines.
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

      {!error && freeGames ? (
        <section id="free-games" className="gt-news__section gt-news__free">
          <h2>Free now</h2>
          <p className="gt-news__hint">
            Claim on the store site (or open the launcher if that account is linked). GameTheca does
            not download DRM titles — after claiming on Steam, re-sync Ownership to badge your library.
          </p>
          {freeGames.length === 0 ? (
            <p>No free offers cached yet. Check back after the next refresh.</p>
          ) : (
            <ul className="gt-news__list gt-news__free-list">
              {freeGames.map((item) => {
                const https = item.links?.https || item.claim_url || item.store_url
                const protocol = item.links?.protocol
                const ends = formatEndsAt(item.ends_at)
                return (
                  <li key={`${item.store}-${item.external_id}`} className="gt-news__card gt-news__free-card">
                    <article>
                      <div className="gt-news__free-row">
                        {item.image_url ? (
                          <img
                            className="gt-news__free-thumb"
                            src={item.image_url}
                            alt=""
                            loading="lazy"
                          />
                        ) : null}
                        <div className="gt-news__free-body">
                          <p className="gt-news__meta">
                            <span className="gt-news__store">{storeLabel(item.store)}</span>
                            {item.worth ? <span>{item.worth}</span> : null}
                            {ends ? <time dateTime={item.ends_at}>Ends {ends}</time> : null}
                            {item.connected ? <span>Linked</span> : null}
                          </p>
                          <strong>{item.title}</strong>
                          {item.description ? <p>{item.description}</p> : null}
                          <p className="gt-news__actions">
                            {https ? (
                              <a className="gt-btn" href={https} target="_blank" rel="noreferrer">
                                Claim
                              </a>
                            ) : null}
                            {protocol && item.connected ? (
                              <a className="gt-btn gt-btn--ghost" href={protocol}>
                                Open in app
                              </a>
                            ) : null}
                            {item.connected && item.id ? (
                              <button
                                type="button"
                                className="gt-btn gt-btn--ghost"
                                onClick={() => void claimAssist(item)}
                              >
                                Sync ownership
                              </button>
                            ) : null}
                          </p>
                          {assistMsg[item.id] ? (
                            <p className="gt-news__assist-msg">{assistMsg[item.id]}</p>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
          )}
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
