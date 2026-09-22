import { useEffect, useState } from 'react'
import { fetchGameAssists } from '../api/assists'
import './OverlayLinksPanel.css'

export interface OverlayLink {
  label: string
  url: string
  kind: 'map' | 'guide' | 'clip' | 'wiki' | 'other' | string
}

const KIND_LABEL: Record<string, string> = {
  map: 'Map',
  guide: 'Guide',
  clip: 'Clip',
  wiki: 'Wiki',
  other: 'Link',
}

/**
 * The companion overlay's assists (INSP-45, Option A): maps, guides, clips and
 * a wiki for the game on screen, as *links*. Shown in the stay-open Friends
 * window when the companion says which game is running (`?game=`). Nothing
 * here reads a process or injects anything — it is a bookmark strip that
 * sits beside the game.
 */
export function OverlayLinksPanel({ gameUuid }: { gameUuid: string }) {
  const [links, setLinks] = useState<OverlayLink[] | null>(null)
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (!gameUuid) return undefined
    const controller = new AbortController()
    fetchGameAssists(gameUuid, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return
        setLinks(Array.isArray(data?.overlay_links) ? (data.overlay_links as OverlayLink[]) : [])
        setTitle(String(data?.pack?.title || ''))
      })
      .catch(() => {
        if (!controller.signal.aborted) setLinks([])
      })
    return () => controller.abort()
  }, [gameUuid])

  if (!gameUuid || !links || links.length === 0) return null

  return (
    <section className="od-overlay-links" aria-labelledby="od-overlay-links-heading">
      <h3 id="od-overlay-links-heading" className="od-overlay-links__title">
        Assists{title ? ` · ${title}` : ''}
      </h3>
      <ul className="od-overlay-links__list">
        {links.map((link) => (
          <li key={`${link.kind}:${link.url}`} className="od-overlay-links__item">
            <span className="od-overlay-links__kind">
              {KIND_LABEL[link.kind] || KIND_LABEL.other}
            </span>
            <a href={link.url} target="_blank" rel="noreferrer noopener">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="od-overlay-links__note">Pages beside the game — nothing reads or changes it.</p>
    </section>
  )
}
