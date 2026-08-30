import { useEffect, useState } from 'react'
import { fetchGameMoreFrom } from '../api/gameDetails'
import { DiscoverShelf } from './DiscoverShelf'

/**
 * Other vault titles from the same developer or publisher.
 * Hidden when the API returns fewer than two others (or none).
 */
export function DetailsMoreFrom({ gameUuid }) {
  const [sections, setSections] = useState([])

  useEffect(() => {
    if (!gameUuid) {
      return undefined
    }
    const controller = new AbortController()
    fetchGameMoreFrom(gameUuid, { signal: controller.signal })
      .then((body) => {
        setSections(Array.isArray(body.sections) ? body.sections : [])
      })
      .catch(() => {
        setSections([])
      })
    return () => controller.abort()
  }, [gameUuid])

  if (!sections.length) {
    return null
  }

  return (
    <div className="gt-details-page__more-from">
      {sections.map((section) => (
        <DiscoverShelf
          key={section.identifier}
          section={section}
          canPin={false}
        />
      ))}
    </div>
  )
}
