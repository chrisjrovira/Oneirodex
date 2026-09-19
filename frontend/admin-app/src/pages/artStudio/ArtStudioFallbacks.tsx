import { FALLBACK_ASSETS } from './artStudioModel'

/** The two placeholder assets with a cache-busted preview of each. */
export function ArtStudioFallbacks({ fallbackBust }: { fallbackBust: number }) {
  return (
    <section
      className="od-admin-panel od-art-studio-fallbacks"
      aria-label="Current library defaults"
    >
      <div className="od-art-studio-fallbacks__head">
        <div>
          <h2 className="od-admin-panel-title">Current library defaults</h2>
          <p className="od-admin-lede">
            Live fallback assets after apply. Hard-refresh member browsers to see updates.
          </p>
        </div>
      </div>
      <div className="od-art-studio-fallbacks__grid">
        {FALLBACK_ASSETS.map((asset) => (
          <figure key={asset.key} className="od-art-studio-fallbacks__card">
            <img
              src={`${asset.path}?v=${fallbackBust}`}
              alt={asset.label}
              onError={(e) => {
                e.currentTarget.style.visibility = 'hidden'
              }}
            />
            <figcaption>
              <strong>{asset.label}</strong>
              <span>{asset.hint}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
