import './DiscoverRowSettings.css'

/**
 * The one place a member can see everything their Discover feed could show.
 *
 * Two controls on a row's own header — Pin and Hide — can arrange a feed but
 * cannot un-arrange it: a hidden row is not on the page, so the control that
 * would bring it back is not on the page either. That is the whole reason this
 * panel exists. It lists every row the feed knows about, including the hidden
 * ones, and it is reachable from the bar rather than from any single row.
 *
 * It is also where pin *order* lives. Pins have always been an ordered list on
 * the server — "order is part of what a member is choosing" is in the API's own
 * docstring — but nothing in the UI had ever been able to express the order, so
 * a member could pin three rows and not say which came first. Up/down here does
 * exactly what the API already supported.
 *
 * Buttons rather than drag handles: drag is a poor fit for a list of three, it
 * needs a keyboard equivalent anyway, and it does not survive a 10-foot remote.
 *
 * @param {object} props
 * @param {{identifier: string, title: string}[]} props.rows Every row the feed
 *   can show, hidden ones included, in feed order.
 * @param {string[]} props.pins Pinned identifiers, in the member's order.
 * @param {string[]} props.hidden Excluded identifiers.
 * @param {number} props.maxPins How many pins the feed reserves room for.
 */
export function DiscoverRowSettings({
  rows = [],
  pins = [],
  hidden = [],
  maxPins = 0,
  onTogglePin,
  onToggleHidden,
  onMovePin,
}) {
  const hiddenSet = new Set(hidden)
  const pinned = pins.map((id) => rows.find((row) => row.identifier === id)).filter(Boolean)
  const rest = rows.filter((row) => !pins.includes(row.identifier))
  const canPin = pins.length < maxPins

  return (
    <div className="od-rowsettings">
      {maxPins > 0 ? (
        <section className="od-rowsettings__group">
          <h3 className="od-rowsettings__heading">
            Pinned to the top
            <span className="od-rowsettings__budget">
              {pins.length} of {maxPins}
            </span>
          </h3>

          {pinned.length === 0 ? (
            <p className="od-rowsettings__empty">
              Nothing pinned yet. Pin a row below to keep it at the top of your feed.
            </p>
          ) : (
            <ol className="od-rowsettings__list">
              {pinned.map((row, index) => (
                <li className="od-rowsettings__row" key={row.identifier}>
                  <span className="od-rowsettings__title">{row.title}</span>
                  <div className="od-cbtn-group">
                    <button
                      type="button"
                      className="od-cbtn od-btn--sm"
                      aria-label={`Move ${row.title} up`}
                      disabled={index === 0}
                      onClick={() => onMovePin?.(row.identifier, -1)}
                    >
                      <span aria-hidden="true">↑</span>
                    </button>
                    <button
                      type="button"
                      className="od-cbtn od-btn--sm"
                      aria-label={`Move ${row.title} down`}
                      disabled={index === pinned.length - 1}
                      onClick={() => onMovePin?.(row.identifier, 1)}
                    >
                      <span aria-hidden="true">↓</span>
                    </button>
                    <button
                      type="button"
                      className="od-cbtn od-btn--sm"
                      onClick={() => onTogglePin?.(row.identifier)}
                    >
                      Unpin
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}

      <section className="od-rowsettings__group">
        <h3 className="od-rowsettings__heading">All rows</h3>
        <ul className="od-rowsettings__list">
          {rest.map((row) => {
            const isHidden = hiddenSet.has(row.identifier)
            return (
              <li
                className="od-rowsettings__row"
                key={row.identifier}
                data-hidden={isHidden ? 'true' : undefined}
              >
                <span className="od-rowsettings__title">{row.title}</span>
                <div className="od-cbtn-group">
                  {/* Pinning a hidden row would be a contradiction the feed
                      cannot render, so the pin is unavailable until it is
                      shown again — and says why. */}
                  <button
                    type="button"
                    className="od-cbtn od-btn--sm"
                    disabled={isHidden || !canPin}
                    title={
                      isHidden
                        ? 'Show this row before pinning it'
                        : canPin
                          ? 'Pin this row to the top'
                          : 'You have pinned as many rows as you can'
                    }
                    onClick={() => onTogglePin?.(row.identifier)}
                  >
                    Pin
                  </button>
                  <button
                    type="button"
                    className={`od-cbtn od-btn--sm${isHidden ? ' is-on' : ''}`}
                    aria-pressed={isHidden}
                    onClick={() => onToggleHidden?.(row.identifier)}
                  >
                    {isHidden ? 'Show' : 'Hide'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>

        {rest.length === 0 ? (
          <p className="od-rowsettings__empty">Every row is pinned.</p>
        ) : null}
      </section>
    </div>
  )
}

export default DiscoverRowSettings
