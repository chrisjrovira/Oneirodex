import { useEffect, useState } from 'react'
import { fetchAnnouncements } from '../api/announcements'
import { claimFreeGameAssist, fetchFreeGames } from '../api/freeGames'
import { fetchGamingNews } from '../api/gamingNews'
import { formatLocaleDate } from '../utils/formatLocaleDate'
import './NewsPage.css'

function formatEndsAt(value) {
  if (!value) {
    return null
  }
  return formatLocaleDate(value, { fallback: null })
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

function truncate(text, max = 140) {
  const value = String(text || '').trim()
  if (value.length <= max) return value
  return `${value.slice(0, max - 1).trim()}…`
}

export function NewsPage() {
  const [announcements, setAnnouncements] = useState(null)
  const [freeGames, setFreeGames] = useState(null)
  const [headlines, setHeadlines] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [assistMsg, setAssistMsg] = useState({})
  const [activeTab, setActiveTab] = useState('all')

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

  const loading = !error && (!announcements || !freeGames || !headlines)
  const showAdmins = activeTab === 'all' || activeTab === 'admins'
  const showFree = activeTab === 'all' || activeTab === 'free'
  const showHeadlines = activeTab === 'all' || activeTab === 'headlines'

  return (
    <div className="gt-more-page gt-news">
      <div className="gt-page-header gt-news__header">
        <div>
          <h1>News</h1>
          <p className="gt-more-page__lede">
            Admin notes, free claims, and gaming headlines.
          </p>
        </div>
        <nav className="gt-news__tabs" aria-label="News sections">
          {[
            ['all', 'All'],
            ['admins', 'Admins'],
            ['free', 'Free now'],
            ['headlines', 'Headlines'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={activeTab === id ? 'is-active' : ''}
              aria-pressed={activeTab === id}
              onClick={() => setActiveTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {error ? (
        <div role="alert">
          <p>Unable to load news.</p>
          <button type="button" onClick={() => setRetryCount((n) => n + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      {loading ? <p>Loading…</p> : null}

      {!error && announcements && showAdmins ? (
        <section className="gt-news__section" aria-labelledby="news-admins-heading">
          <div className="gt-news__section-head">
            <h2 id="news-admins-heading">From your admins</h2>
            <span className="gt-news__count">{announcements.length}</span>
          </div>
          {announcements.length === 0 ? <p className="gt-news__empty">No announcements yet.</p> : null}
          {announcements.length > 0 ? (
            <ul className="gt-news__list">
              {announcements.map((item) => (
                <li key={item.id} className="gt-news__card gt-news__card--admin">
                  <article>
                    <header className="gt-news__card-head">
                      <strong>{item.title}</strong>
                      {item.created_at ? (
                        <time dateTime={item.created_at}>
                          {formatLocaleDate(item.created_at)}
                        </time>
                      ) : null}
                    </header>
                    <p>{truncate(item.body, 220)}</p>
                  </article>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {!error && freeGames && showFree ? (
        <section id="free-games" className="gt-news__section gt-news__free" aria-labelledby="news-free-heading">
          <div className="gt-news__section-head">
            <h2 id="news-free-heading">Free now</h2>
            <span className="gt-news__count">{freeGames.length}</span>
          </div>
          <p className="gt-news__hint">
            Claim on the store. GameTheca does not download DRM titles — sync Ownership after claiming.
          </p>
          {freeGames.length === 0 ? (
            <p className="gt-news__empty">No free offers cached yet. Check back after the next refresh.</p>
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
                        ) : (
                          <div className="gt-news__free-thumb gt-news__free-thumb--empty" aria-hidden="true" />
                        )}
                        <div className="gt-news__free-body">
                          <p className="gt-news__meta">
                            <span className="gt-news__store">{storeLabel(item.store)}</span>
                            {item.worth ? <span>{item.worth}</span> : null}
                            {ends ? <time dateTime={item.ends_at}>Ends {ends}</time> : null}
                            {item.connected ? <span className="gt-news__linked">Linked</span> : null}
                          </p>
                          <strong>{item.title}</strong>
                          {item.description ? <p>{truncate(item.description, 110)}</p> : null}
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

      {!error && headlines && showHeadlines ? (
        <section className="gt-news__section" aria-labelledby="news-headlines-heading">
          <div className="gt-news__section-head">
            <h2 id="news-headlines-heading">Gaming headlines</h2>
            <span className="gt-news__count">{headlines.length}</span>
          </div>
          {headlines.length === 0 ? (
            <p className="gt-news__empty">No external headlines available right now.</p>
          ) : (
            <ul className="gt-news__list gt-news__headline-list">
              {headlines.map((item) => (
                <li key={item.url} className="gt-news__card gt-news__headline">
                  <article>
                    <a className="gt-news__headline-link" href={item.url} target="_blank" rel="noreferrer">
                      <strong>{item.title}</strong>
                    </a>
                    {item.summary ? <p>{truncate(item.summary, 160)}</p> : null}
                    <p className="gt-news__meta">
                      <span>{item.source}</span>
                      {item.published_at ? (
                        <time dateTime={item.published_at}>{String(item.published_at).slice(0, 16)}</time>
                      ) : null}
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
