/**
 * Re-export shim. The glyphs live in `@oneirodex/ui` so the member and admin
 * shells cannot drift apart again — they already had, by one glyph.
 *
 * Kept at this path because call sites import `./railIcons`; the module itself
 * is `frontend/shared/src/railIcons.tsx`.
 */
export { railIconPaths, RailIcon, RAIL_VIEWBOX } from '@oneirodex/ui'
export type { RailIconProps } from '@oneirodex/ui'
