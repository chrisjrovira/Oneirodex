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
 * Sized like a game tile so the row keeps the page's vertical rhythm, but it is
 * type rather than art — an announcement has no cover, and a free-game offer's
 * image is the store's, not ours.
 */
export function NewsCard({ item }) {
  const isOffer = item.kind === 'free_game'
  const badge = isOffer ? STORE_LABELS[item.store] || 'Free' : 'News'
  const when = whenLabel(item.published_at)

  return (
    <Link className="gt-news-card" to={item.href || '/news'}>
      {item.image_url ? (
        <img className="gt-news-card__art" src={item.image_url} alt="" loading="lazy" />
      ) : null}
      <span className="gt-news-card__badge" data-kind={item.kind}>
        {badge}
      </span>
      <span className="gt-news-card__title">{item.title}</span>
      {item.summary ? (
        <span className="gt-news-card__summary">{item.summary}</span>
      ) : null}
      {when ? <span className="gt-news-card__when">{when}</span> : null}
    </Link>
  )
}
