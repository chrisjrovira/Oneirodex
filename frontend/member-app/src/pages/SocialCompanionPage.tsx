import { useSearchParams } from 'react-router-dom'
import { OverlayLinksPanel } from '../components/OverlayLinksPanel'
import { SocialCompanionDock } from '../components/SocialCompanionDock'

/**
 * The stay-open Friends window the desktop companion pops out. When the
 * companion says which game is on screen (`?game=<uuid>`), the overlay's
 * assists (INSP-45: maps, guides, clips, wiki — links only) sit above the dock.
 */
export function SocialCompanionPage() {
  const [params] = useSearchParams()
  const gameUuid = (params.get('game') || '').trim()
  return (
    <>
      {gameUuid ? <OverlayLinksPanel gameUuid={gameUuid} /> : null}
      <SocialCompanionDock mode="standalone" forceOpen gameUuid={gameUuid} />
    </>
  )
}
