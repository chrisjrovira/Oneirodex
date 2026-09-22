import { Button } from '@oneirodex/ui'
import type { SavePath } from './detailsTypes'

const OS_LABEL: Record<string, string> = { windows: 'Windows', linux: 'Linux', mac: 'macOS' }

/**
 * Where this game keeps its saves (INSP-1), from the community manifest.
 * Paths keep their placeholders (`<winAppData>`, `<home>`, …) because they
 * are true for every household PC; the companion expands them for the one
 * it runs on when asked to open the folder. Nothing here syncs or copies.
 */
export function SavePathsFact({
  paths,
  canOpen,
  onOpen,
}: {
  paths: SavePath[]
  canOpen: boolean
  onOpen: (path: string) => void
}) {
  const seen = new Set<string>()
  const rows = paths.filter((p) => {
    const key = `${p.os || ''}:${p.path}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return (
    <ul className="od-details-page__save-paths">
      {rows.map((row) => (
        <li
          key={`${row.os || 'any'}:${row.store || 'any'}:${row.path}`}
          className="od-details-page__save-path"
        >
          {row.os ? (
            <span className="od-details-page__save-os">{OS_LABEL[row.os] || row.os}</span>
          ) : null}
          {row.store ? <span className="od-details-page__save-os">{row.store}</span> : null}
          <code className="od-details-page__path-value" title={row.path}>
            {row.path}
          </code>
          {canOpen && (!row.os || row.os === 'windows') ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => onOpen(row.path)}>
              Open save folder
            </Button>
          ) : null}
        </li>
      ))}
      <li className="od-details-page__save-note">
        From the community save-location manifest — the folder, not a backup. The companion expands
        the placeholders for its own PC.
      </li>
    </ul>
  )
}
