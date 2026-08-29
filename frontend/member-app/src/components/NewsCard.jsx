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

function whenLabel(value) {
  if (!value) return ''
  const when = new Date(value)
  if (Number.isNaN(when.getTime())) return ''
  return when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * A tile on the Discover news row.
 *
 * Image fills the art frame; store/News badge bottom-left and date bottom-right
 * sit on the art. The title stays under the image (game-tile caption rhythm).
 */
export function NewsCard({ item }) {
  const isOffer = item.kind === 'free_game'
  const badge = isOffer ? STORE_LABELS[item.store] || 'Free' : 'News'
  const when = whenLabel(item.published_at)

  return (
    <Link className="gt-news-card" to={item.href || '/news'}>
      <span className="gt-news-card__art-wrap">
        {item.image_url ? (
          <img className="gt-news-card__art" src={item.image_url} alt="" loading="lazy" />
        ) : (
          <span className="gt-news-card__art gt-news-card__art--empty" aria-hidden="true" />
        )}
        <span className="gt-news-card__badge" data-kind={item.kind}>
          {badge}
        </span>
        {when ? <span className="gt-news-card__when">{when}</span> : null}
      </span>
      <span className="gt-news-card__title">{item.title}</span>
    </Link>
  )
}
