import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import './NewsCard.css'

const STORE_LABELS = {
  steam: 'Steam',
  epic: 'Epic',
  gog: 'GOG',
  amazon: 'Amazon',
  itch: 'itch.io',
  humble: 'Humble',
}

/** Wider than this → letterbox on a blurred fill (true 3:4 cover is 0.75). */
const LETTERBOX_RATIO = 0.9

function whenLabel(value) {
  if (!value) return ''
  const when = new Date(value)
  if (Number.isNaN(when.getTime())) return ''
  return when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function badgeFor(item) {
  if (item.kind === 'deal') {
    const store = STORE_LABELS[item.store] || 'Deal'
    const savings = Number(item.savings)
    if (Number.isFinite(savings) && savings > 0) {
      return `${store} -${Math.round(savings)}%`
    }
    return store
  }
  if (item.kind === 'free_game') {
    return STORE_LABELS[item.store] || 'Free'
  }
  return 'News'
}

/**
 * A tile on the Discover news / deals rows.
 *
 * Art is a 3:4 cover in the same tile box as a game card. Badge + date +
 * title overlay the image so the scrollbar lane matches every other row.
 * Wide store banners letterbox on a blurred copy of themselves so nothing
 * stretches and empty bands are not bare.
 *
 * Deal tiles use HTTPS store redirects — those must be plain anchors, not
 * React Router links.
 */
export function NewsCard({ item }) {
  const badge = badgeFor(item)
  const when = whenLabel(item.published_at)
  const [fit, setFit] = useState('cover')
  const href = item.href || '/news'
  const external = /^https?:\/\//i.test(href)

  const onArtLoad = useCallback((event) => {
    const img = event.currentTarget
    const w = img.naturalWidth
    const h = img.naturalHeight
    if (!w || !h) return
    setFit(w / h > LETTERBOX_RATIO ? 'letterbox' : 'cover')
  }, [])

  const body = (
    <span className="od-news-card__art-wrap">
      {item.image_url ? (
        <>
          {fit === 'letterbox' ? (
            <img
              className="od-news-card__art-fill"
              src={item.image_url}
              alt=""
              aria-hidden="true"
              loading="lazy"
            />
          ) : null}
          <img
            className="od-news-card__art"
            data-fit={fit}
            src={item.image_url}
            alt=""
            loading="lazy"
            onLoad={onArtLoad}
          />
        </>
      ) : (
        <span className="od-news-card__art od-news-card__art--empty" aria-hidden="true" />
      )}
      <span className="od-news-card__badge" data-kind={item.kind || 'announcement'}>
        {badge}
      </span>
      {when ? <span className="od-news-card__when">{when}</span> : null}
      <span className="od-news-card__title">{item.title}</span>
    </span>
  )

  if (external) {
    return (
      <a
        className="od-news-card"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {body}
      </a>
    )
  }

  return (
    <Link className="od-news-card" to={href}>
      {body}
    </Link>
  )
}
