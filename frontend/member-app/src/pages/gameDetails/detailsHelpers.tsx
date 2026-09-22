import { Link } from 'react-router-dom'
import { taxonomyHref } from '../../utils/detailsTaxonomy'

export function formatPlaytime(seconds: unknown): string {
  const total = Number(seconds) || 0
  if (total <= 0) {
    return 'Not played yet'
  }
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (hours <= 0) {
    return `${minutes}m`
  }
  return `${hours}h ${minutes}m`
}

export function TaxonomyChip({ kind, name }: { kind: string; name: string }) {
  return (
    <Link className="chip od-chip" to={taxonomyHref(kind, name)}>
      {name}
    </Link>
  )
}
