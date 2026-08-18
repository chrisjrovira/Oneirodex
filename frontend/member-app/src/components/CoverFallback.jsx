/**
 * What a tile shows when there is no cover art.
 *
 * Drawn, never fetched. The previous fallback was `default_cover.jpg` — one
 * raster with the GameTheca mark and the words baked into it. Two things were
 * wrong with that and neither could be fixed in the file: the baked text was
 * set for a fixed tile size and became unreadable once the size slider went
 * continuous (120px … 300px), and the baked mark stayed the default green on
 * every theme, so a tile with no art was the one thing on the page that never
 * changed colour.
 *
 * Here the mark is a CSS mask filled with `--gt-accent` and the title is real
 * text clamped against `--gt-tile-min`, so both scale with the tile and both
 * follow the theme. Styles live in the theme's components.css alongside
 * `.game-cover`, because the two have to occupy the same box.
 *
 * `aria-hidden` on the whole block: GameCard already renders the game's name in
 * a visually-hidden span and the link is labelled, so announcing the title a
 * second time would only add noise.
 */
export function CoverFallback({ name }) {
  return (
    <div className="gt-cover-fallback" data-cover-fallback aria-hidden="true">
      <span className="gt-cover-fallback__mark gt-brand-mark" />
      <p className="gt-cover-fallback__title">{name}</p>
      <p className="gt-cover-fallback__note">No cover art</p>
    </div>
  )
}
