import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAnnouncements } from '../api/announcements'
import { claimFreeGameAssist, fetchFreeGames } from '../api/freeGames'
import { fetchGamingNews } from '../api/gamingNews'
import { ContextBar } from '../chrome/ContextBar'
import { formatLocaleDate } from '../utils/formatLocaleDate'
import { PageStatus } from '../components/PageStatus'
import '../styles/panelGrid.css'
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

function tabFromHash() {
  if (typeof window === 'undefined') return null
  const hash = (window.location.hash || '').replace(/^#/, '')
  if (hash === 'free-games' || hash === 'free') return 'free'
  return null
}

// One list, two renderers: the old tab strip and bar two's segmented control
// must never drift apart into different sets of sections.
const MUTED_SOURCES_KEY = 'gt.news.mutedSources'

const NEWS_VIEWS = [
  { id: 'all', label: 'All' },
  { id: 'admins', label: 'Admins' },
  { id: 'free', label: 'Free now' },
  { id: 'headlines', label: 'Headlines' },
]

export function NewsPage({ shellConfig = {} }) {
  const useNewChrome = Boolean(shellConfig.enableNewChrome)
  const [announcements, setAnnouncements] = useState(null)
  const [freeGames, setFreeGames] = useState(null)
  const [headlines, setHeadlines] = useState(null)
  const [sources, setSources] = useState([])
  // Which sites the reader has switched off. Kept client-side: this is a view
  // preference over a list the operator controls, not account state, and a
  // schema column for "I do not care for that site" would be heavier than the
  // thing it stores.
  const [mutedSources, setMutedSources] = useState(() => {
    try {
      return new Set(JSON.parse(window.localStorage.getItem(MUTED_SOURCES_KEY) || '[]'))
    } catch {
      return new Set()
    }
  })
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [assistMsg, setAssistMsg] = useState({})
  const [activeTab, setActiveTab] = useState(() => tabFromHash() || 'all')

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
    function onHash() {
      const fromHash = tabFromHash()
      if (fromHash) setActiveTab(fromHash)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

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
        setSources(Array.isArray(newsData.sources) ? newsData.sources : [])
      } else {
        setHeadlines([])
      }
    })

    return () => {
      active = false
      controller.abort()
    }
  }, [retryCount])

  function toggleSource(source) {
    setMutedSources((previous) => {
      const next = new Set(previous)
      if (next.has(source)) next.delete(source)
      else next.add(source)
      try {
        window.localStorage.setItem(MUTED_SOURCES_KEY, JSON.stringify([...next]))
      } catch {
        // View preference only — the filter still applies for this session.
      }
      return next
    })
  }

  // Muting a site hides its articles everywhere on this page, including the
  // hero — a muted source promoted to the featured slot would be the one story
  // you asked not to see, in the largest box.
  const visibleHeadlines = useMemo(
    () => (headlines || []).filter((item) => !mutedSources.has(item.source)),
    [headlines, mutedSources],
  )

  const loading = !error && (!announcements || !freeGames || !headlines)
  const showAdmins = activeTab === 'all' || activeTab === 'admins'
  const showFree = activeTab === 'all' || activeTab === 'free'
  const showHeadlines = activeTab === 'all' || activeTab === 'headlines'

  const featured = useMemo(() => {
    if (activeTab === 'free' || activeTab === 'headlines') return null
    if (announcements?.length) {
      return { kind: 'admin', item: announcements[0] }
    }
    if (activeTab === 'admins') return null
    if (visibleHeadlines.length) {
      return { kind: 'headline', item: visibleHeadlines[0] }
    }
    if (freeGames?.length) {
      return { kind: 'free', item: freeGames[0] }
    }
    return null
  }, [activeTab, announcements, visibleHeadlines, freeGames])

  const adminRest =
    announcements && featured?.kind === 'admin'
      ? announcements.slice(1)
      : announcements || []
  const headlineRest =
    featured?.kind === 'headline' ? visibleHeadlines.slice(1) : visibleHeadlines
  const freeRest = freeGames && featured?.kind === 'free' ? freeGames.slice(1) : freeGames || []

  // Counts ride on the segments themselves rather than a separate summary —
  // "Free now 3" answers the question the tab was asking. Omitted while
  // loading, so a section never reads as empty when it is simply unfetched.
  const viewsWithCounts = useMemo(() => {
    if (loading || error) return NEWS_VIEWS
    const counts = {
      admins: announcements?.length || 0,
      free: freeGames?.length || 0,
      headlines: visibleHeadlines.length,
    }
    counts.all = counts.admins + counts.free + counts.headlines
    return NEWS_VIEWS.map((view) => ({ ...view, count: counts[view.id] }))
  }, [loading, error, announcements, freeGames, visibleHeadlines])

  return (
    <>
    {useNewChrome ? (
        <ContextBar
          views={viewsWithCounts}
          activeView={activeTab}
          onSelectView={setActiveTab}
        />
      ) : null}
    <div className="gt-more-page gt-news gt-panels">
      {useNewChrome ? null : (
        <div className="gt-page-header gt-news__header gt-panels__full">
          <div>
            <h1>News</h1>
            <p className="gt-more-page__lede">
              Admin notes, free claims, and gaming headlines.
            </p>
          </div>
          <nav className="gt-news__tabs" aria-label="News sections">
            {NEWS_VIEWS.map(({ id, label }) => (
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
      )}

      <PageStatus
        loading={loading}
        error={error}
        errorMessage="Unable to load news."
        loadingMessage="Loading news…"
        onRetry={() => setRetryCount((n) => n + 1)}
      />

      {!error && !loading && featured && (activeTab === 'all' || activeTab === 'admins') ? (
        <section className="gt-news__hero gt-panels__full" aria-label="Featured">
          <p className="gt-news__hero-kicker">
            {featured.kind === 'admin'
              ? 'From your admins'
              : featured.kind === 'free'
                ? 'Free now'
                : 'Headline'}
          </p>
          {featured.kind === 'headline' ? (
            <a
              className="gt-news__hero-link"
              href={featured.item.url}
              target="_blank"
              rel="noreferrer"
            >
              <h2 className="gt-news__hero-title">{featured.item.title}</h2>
            </a>
          ) : (
            <h2 className="gt-news__hero-title">{featured.item.title}</h2>
          )}
          {featured.kind === 'admin' && featured.item.body ? (
            <p className="gt-news__hero-body">{truncate(featured.item.body, 280)}</p>
          ) : null}
          {featured.kind === 'headline' && featured.item.summary ? (
            <p className="gt-news__hero-body">{truncate(featured.item.summary, 220)}</p>
          ) : null}
          {featured.kind === 'free' && featured.item.description ? (
            <p className="gt-news__hero-body">{truncate(featured.item.description, 180)}</p>
          ) : null}
          <p className="gt-news__hero-meta">
            {featured.kind === 'admin' && featured.item.created_at ? (
              <time dateTime={featured.item.created_at}>
                {formatLocaleDate(featured.item.created_at)}
              </time>
            ) : null}
            {featured.kind === 'headline' ? (
              <>
                <span>{featured.item.source}</span>
                {featured.item.published_at ? (
                  <time dateTime={featured.item.published_at}>
                    {formatLocaleDate(featured.item.published_at)}
                  </time>
                ) : null}
              </>
            ) : null}
            {featured.kind === 'free' ? (
              <>
                <span className="gt-news__store">{storeLabel(featured.item.store)}</span>
                {featured.item.ends_at ? (
                  <time dateTime={featured.item.ends_at}>
                    Ends {formatEndsAt(featured.item.ends_at)}
                  </time>
                ) : null}
              </>
            ) : null}
          </p>
        </section>
      ) : null}

      {/* Admin notes lead, full width, and only when there are any.
          `announcements` is an array, so the old `announcements &&` was true
          even when empty and rendered a heading, a zero count and "No
          announcements yet." — a permanent empty panel taking a column from the
          two sections that always have something in them. On the Admins tab the
          empty state still shows, because there the section *is* the page and
          silence would read as a failed load. */}
      {!error && announcements && showAdmins && (announcements.length > 0 || activeTab === 'admins') ? (
        <section className="gt-news__section gt-panels__full" aria-labelledby="news-admins-heading">
          <div className="gt-news__section-head">
            <h2 id="news-admins-heading">From your admins</h2>
            <span className="gt-news__count">{announcements.length}</span>
          </div>
          {announcements.length === 0 ? <p className="gt-news__empty">No announcements yet.</p> : null}
          {adminRest.length > 0 ? (
            <ul className="gt-news__rail">
              {adminRest.map((item) => (
                <li key={item.id} className="gt-news__rail-item gt-news__rail-item--admin">
                  <article>
                    <header className="gt-news__rail-head">
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
            Claim on the store. Oneirodex does not download DRM titles — sync Ownership after claiming.
          </p>
          {freeGames.length === 0 ? (
            <p className="gt-news__empty">No free offers cached yet. Check back after the next refresh.</p>
          ) : (
            <ul className="gt-news__free-strip">
              {(activeTab === 'free' ? freeGames : freeRest).map((item) => {
                const https = item.links?.https || item.claim_url || item.store_url
                const protocol = item.links?.protocol
                const ends = formatEndsAt(item.ends_at)
                return (
                  <li key={`${item.store}-${item.external_id}`} className="gt-news__free-tile">
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
                          {/* FEAT-D6: one action that does the right thing.
                              Linked store → claim assist opens the offer *and*
                              registers ownership. Not linked → plain deeplink,
                              with the reason it is not seamless stated once. */}
                          <p className="gt-news__actions">
                            {item.connected && item.id ? (
                              <>
                                <button
                                  type="button"
                                  className="gt-btn gt-btn--primary"
                                  onClick={() => void claimAssist(item)}
                                >
                                  Claim &amp; sync
                                </button>
                                {protocol ? (
                                  <a className="gt-btn gt-btn--ghost" href={protocol}>
                                    Open in app
                                  </a>
                                ) : null}
                              </>
                            ) : (
                              <>
                                {https ? (
                                  <a
                                    className="gt-btn gt-btn--primary"
                                    href={https}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Claim on {storeLabel(item.store)}
                                  </a>
                                ) : null}
                                <Link className="gt-news__connect-hint" to="/ownership">
                                  Link {storeLabel(item.store)} to sync automatically
                                </Link>
                              </>
                            )}
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

      {/* Headlines take a column rather than the full row, so News and Free sit
          side by side under the admin notes. Spanning the row was what pushed
          Free up beside admins and left the page reading as one long scroll on
          the tab that shows everything. */}
      {!error && headlines && showHeadlines ? (
        <section className="gt-news__section gt-news__headlines" aria-labelledby="news-headlines-heading">
          <div className="gt-news__section-head">
            <h2 id="news-headlines-heading">Gaming headlines</h2>
            <span className="gt-news__count">{visibleHeadlines.length}</span>
          </div>

          {/* Pick your sites. Every configured source is listed whether or not
              it has an article today — filtering by what happened to arrive
              would hide a quiet site behind its own silence. */}
          {sources.length > 0 ? (
            <div className="gt-news__sources" role="group" aria-label="Headline sources">
              {sources.map((source) => {
                const on = !mutedSources.has(source)
                return (
                  <button
                    key={source}
                    type="button"
                    className="gt-cbtn gt-news__source"
                    aria-pressed={on}
                    onClick={() => toggleSource(source)}
                    title={on ? `Hide ${source}` : `Show ${source}`}
                  >
                    {source}
                  </button>
                )
              })}
            </div>
          ) : null}

          {visibleHeadlines.length === 0 ? (
            <p className="gt-news__empty">
              {mutedSources.size > 0 && headlines.length > 0
                ? 'Every source is switched off — turn one back on above.'
                : 'No external headlines available right now.'}
            </p>
          ) : (
            /* Image-forward cards (UX-C14) — the way Steam/Epic present news.
               Feeds that carry no artwork fall back to a text card rather than
               a broken frame. */
            <ul className="gt-news__cards">
              {(activeTab === 'headlines' ? visibleHeadlines : headlineRest).map((item) => (
                <li key={item.url} className="gt-news__card">
                  <a
                    className="gt-news__card-link"
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.image_url ? (
                      <img
                        className="gt-news__card-art"
                        src={item.image_url}
                        alt=""
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.classList.add('is-broken')
                        }}
                      />
                    ) : (
                      <span className="gt-news__card-art gt-news__card-art--empty" aria-hidden="true" />
                    )}
                    <span className="gt-news__card-body">
                      <strong className="gt-news__card-title">{item.title}</strong>
                      {item.summary ? (
                        <span className="gt-news__card-summary">{truncate(item.summary, 140)}</span>
                      ) : null}
                      <span className="gt-news__meta">
                        <span className="gt-news__source">{item.source}</span>
                        {item.published_at ? (
                          <time dateTime={item.published_at}>
                            {formatLocaleDate(item.published_at)}
                          </time>
                        ) : null}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
    </>
  )
}
