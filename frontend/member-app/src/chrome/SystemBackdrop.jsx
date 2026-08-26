import './systemBackdrop.css'
import { familyForPlatform } from './platformSkins'
import { roomIdForPlatform, roomStyle } from './playRooms'

/**
 * Dimmed, system-themed backdrop behind the library grid.
 *
 * Two rules drive everything here:
 *
 * 1. **It must not compete with the tiles.** Cover art is the content; this is
 *    atmosphere. Everything is low-opacity and sits behind the grid with
 *    `pointer-events: none`, so it can never intercept a click.
 * 2. **It is generated, not vendored.** 70-odd platforms would mean 70-odd
 *    image assets to ship, licence and keep in sync. The system's own name is
 *    the artwork, set in the era-appropriate face, over a family-tinted wash.
 *
 * Renders nothing when no single system is selected — a mixed library gets no
 * backdrop rather than an arbitrary one.
 */

/** Era face per family, matching the server-side PLATFORM_FONT_HINTS grouping. */
const FAMILY_FACE = {
  nintendo: "'Press Start 2P', 'Silkscreen', monospace",
  sega: "'Share Tech Mono', monospace",
  sony: "'Orbitron', 'Arial Black', sans-serif",
  xbox: "'Orbitron', 'Arial Black', sans-serif",
  atari: "'Press Start 2P', monospace",
  pc: "'VT323', 'Courier New', monospace",
}

export function SystemBackdrop({ platform, label }) {
  if (!platform) {
    return null
  }
  const family = familyForPlatform(platform) || 'pc'
  const room = roomIdForPlatform(platform)
  const name = (label || platform || '').trim()
  if (!name) {
    return null
  }

  return (
    <div
      className="gt-system-backdrop"
      data-backdrop-family={family}
      data-play-room={room}
      style={roomStyle(platform)}
      aria-hidden="true"
    >
      <div className="gt-system-backdrop__wall" />
      <div className="gt-system-backdrop__wash" />
      <div className="gt-system-backdrop__grid" />
      <span
        className="gt-system-backdrop__name"
        style={{ fontFamily: FAMILY_FACE[family] || FAMILY_FACE.pc }}
      >
        {name}
      </span>
    </div>
  )
}
