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

/**
 * A tile on the Discover news row.
 *
 * Art fills the same 2×3 frame as a game cover. Badge + date + title overlay
 * the image (game-tile rhythm). Wide store banners letterbox on a blurred
 * copy of themselves so nothing stretches and empty bands are not bare.
 */
export function NewsCard({ item }) {
  const isOffer = item.kind === 'free_game'
  const badge = isOffer ? STORE_LABELS[item.store] || 'Free' : 'News'
  const when = whenLabel(item.published_at)
  const [fit, setFit] = useState('cover')

  const onArtLoad = useCallback((event) => {
    const img = event.currentTarget
    const w = img.naturalWidth
    const h = img.naturalHeight
    if (!w || !h) return
    setFit(w / h > LETTERBOX_RATIO ? 'letterbox' : 'cover')
  }, [])

  return (
    <Link className="gt-news-card" to={item.href || '/news'}>
      <span className="gt-news-card__art-wrap">
        {item.image_url ? (
          <>
            {fit === 'letterbox' ? (
              <img
                className="gt-news-card__art-fill"
                src={item.image_url}
                alt=""
                aria-hidden="true"
                loading="lazy"
              />
            ) : null}
            <img
              className="gt-news-card__art"
              data-fit={fit}
              src={item.image_url}
              alt=""
              loading="lazy"
              onLoad={onArtLoad}
            />
          </>
        ) : (
          <span className="gt-news-card__art gt-news-card__art--empty" aria-hidden="true" />
        )}
        <span className="gt-news-card__badge" data-kind={item.kind}>
          {badge}
        </span>
        {when ? <span className="gt-news-card__when">{when}</span> : null}
        <span className="gt-news-card__title">{item.title}</span>
      </span>
    </Link>
  )
}
