import { SocialCompanionDock } from '../components/SocialCompanionDock'

/**
 * Dedicated stay-open friends companion window (pop-out / desktop).
 * No library chrome — meant to sit beside Big Picture or a game.
 */
export function SocialCompanionPage() {
  return <SocialCompanionDock mode="standalone" forceOpen />
}
