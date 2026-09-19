import { formatEndsAt, storeLabel, truncate } from './newsHelpers'
import type { NewsItem } from './newsTypes'
import { Button } from '@oneirodex/ui'
import { Link } from 'react-router-dom'

/** Free-now offers with the claim-assist buttons. */
export function NewsFreeGamesSection({
  assistMsg,
  claimAssist,
  error,
  freeGames,
  freeItems,
  layout,
  showFree,
}: {
  assistMsg: Record<string, string>
  claimAssist: (item: NewsItem) => Promise<void>
  error: unknown
  freeGames: NewsItem[] | null
  freeItems: NewsItem[]
  layout: string
  showFree: boolean
}) {
  return (
    <>
      {!error && freeGames && showFree ? (
        <section
          id="free-games"
          className="od-news__section od-news__free"
          aria-labelledby="news-free-heading"
        >
          <div className="od-news__section-head">
            <h2 id="news-free-heading">Free now</h2>
            <span className="od-news__count">{freeGames.length}</span>
          </div>
          <p className="od-news__hint">
            Claim on the store. Oneirodex does not download DRM titles — sync Ownership after
            claiming.
          </p>
          {freeGames.length === 0 ? (
            <p className="od-news__empty">
              No free offers cached yet. Check back after the next refresh.
            </p>
          ) : layout === 'rss' ? (
            <div className="od-news__panel-body">
              <ul className="od-news__magazine">
                {freeItems.map((item: any) => {
                  const https = item.links?.https || item.claim_url || item.store_url
                  const protocol = item.links?.protocol
                  const ends = formatEndsAt(item.ends_at)
                  return (
                    <li key={`${item.store}-${item.external_id}`} className="od-news__mag-row">
                      <article>
                        <header className="od-news__rail-head">
                          <span className="od-news__store">{storeLabel(item.store)}</span>
                          <strong>{item.title}</strong>
                          {ends ? <time dateTime={item.ends_at}>Ends {ends}</time> : null}
                        </header>
                        <p className="od-news__actions">
                          {item.connected && item.id ? (
                            <Button
                              type="button"
                              variant="primary"
                              onClick={() => void claimAssist(item)}
                            >
                              Claim &amp; sync
                            </Button>
                          ) : https ? (
                            <a
                              className="od-btn od-btn--primary"
                              href={https}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Claim on {storeLabel(item.store)}
                            </a>
                          ) : null}
                          {protocol ? (
                            <a className="od-btn od-btn--ghost" href={protocol}>
                              Open in app
                            </a>
                          ) : null}
                        </p>
                        {assistMsg[item.id] ? (
                          <p className="od-news__assist-msg">{assistMsg[item.id]}</p>
                        ) : null}
                      </article>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <div className="od-news__panel-body">
              <ul className="od-news__free-strip">
                {freeItems.map((item: any) => {
                  const https = item.links?.https || item.claim_url || item.store_url
                  const protocol = item.links?.protocol
                  const ends = formatEndsAt(item.ends_at)
                  return (
                    <li key={`${item.store}-${item.external_id}`} className="od-news__free-tile">
                      <article>
                        <div className="od-news__free-row">
                          {item.image_url ? (
                            <img
                              className="od-news__free-thumb"
                              src={item.image_url}
                              alt=""
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className="od-news__free-thumb od-news__free-thumb--empty"
                              aria-hidden="true"
                            />
                          )}
                          <div className="od-news__free-body">
                            <p className="od-news__meta">
                              <span className="od-news__store">{storeLabel(item.store)}</span>
                              {item.worth ? <span>{item.worth}</span> : null}
                              {ends ? <time dateTime={item.ends_at}>Ends {ends}</time> : null}
                              {item.connected ? (
                                <span className="od-news__linked">Linked</span>
                              ) : null}
                            </p>
                            <strong>{item.title}</strong>
                            {item.description ? <p>{truncate(item.description, 110)}</p> : null}
                            {/* FEAT-D6: one action that does the right thing.
                          Linked store → claim assist opens the offer *and*
                          registers ownership. Not linked → plain deeplink,
                          with the reason it is not seamless stated once. */}
                            <p className="od-news__actions">
                              {item.connected && item.id ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="primary"
                                    onClick={() => void claimAssist(item)}
                                  >
                                    Claim &amp; sync
                                  </Button>
                                  {protocol ? (
                                    <a className="od-btn od-btn--ghost" href={protocol}>
                                      Open in app
                                    </a>
                                  ) : null}
                                </>
                              ) : (
                                <>
                                  {https ? (
                                    <a
                                      className="od-btn od-btn--primary"
                                      href={https}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Claim on {storeLabel(item.store)}
                                    </a>
                                  ) : null}
                                  <Link className="od-news__connect-hint" to="/ownership">
                                    Link {storeLabel(item.store)} to sync automatically
                                  </Link>
                                </>
                              )}
                            </p>
                            {assistMsg[item.id] ? (
                              <p className="od-news__assist-msg">{assistMsg[item.id]}</p>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </section>
      ) : null}
    </>
  )
}
