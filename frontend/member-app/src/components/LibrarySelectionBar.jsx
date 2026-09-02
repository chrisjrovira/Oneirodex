import { BATCH_PLAY_STATUS_OPTIONS } from '../api/batchActions'
import { Popover } from '../chrome/ContextBar'
import './LibrarySelectionBar.css'

/**
 * Compact selection actions while Game Catalog multi-select is non-empty.
 *
 * Under new chrome this mounts in the top bar (replacing All/Games/View).
 * Classic chrome still sticky-sticks it above the grid. Either way the
 * controls are one fused `.od-cbtn-group` — the same language as Library
 * Apply/Clear — not a second row of `.od-btn` slabs.
 *
 * Favorite and Wishlist are single toggles driven by the selection's current
 * state (all-on → offer remove; otherwise offer add). Clear is the count chip.
 */
export function LibrarySelectionBar({
  count,
  busy = false,
  wishlistAvailable = true,
  playStatusAvailable = true,
  refreshImagesAvailable = true,
  /** When every selected title is already favorited, show Unfavorite. */
  favoriteMode = 'add',
  /** When every selected title is already on the wishlist, show Remove. */
  wishlistMode = 'add',
  onFavorite,
  onUnfavorite,
  onRefreshFreshness,
  onRefreshImages,
  onWishlist,
  onWishlistRemove,
  onPlayStatus,
  onSelectPage,
  onClear,
  t = (s) => s,
  /** When true, drop sticky/card chrome — the top bar already frames it. */
  inTopBar = false,
}) {
  if (!count) {
    return null
  }

  const wishlistDisabled = busy || !wishlistAvailable
  const playStatusDisabled = busy || !playStatusAvailable
  const refreshImagesDisabled = busy || !refreshImagesAvailable
  const favorited = favoriteMode === 'remove'
  const wishlisted = wishlistMode === 'remove'
  const wishlistTitle = !wishlistAvailable
    ? t('Batch wishlist is not available yet')
    : wishlisted
      ? t('Remove selected titles from wishlist')
      : t('Add selected titles to wishlist')
  const playStatusTitle = playStatusAvailable
    ? t('Set play status for selected titles')
    : t('Batch play status is not available yet')
  const refreshImagesTitle = refreshImagesAvailable
    ? t('Refresh covers for selected titles (max 20)')
    : t('Batch cover refresh is not available yet')

  return (
    <div
      className={`od-library-selection${inTopBar ? ' od-library-selection--bar' : ''}`}
      role="toolbar"
      aria-label={t('Game Catalog selection actions')}
      data-selection-count={count}
    >
      <div className="od-cbtn-group" role="group" aria-label={t('Selection actions')}>
        <button
          type="button"
          className="od-cbtn is-on od-library-selection__count"
          aria-live="polite"
          aria-label={count === 1 ? t('1 selected') : t(`${count} selected`)}
          title={t('Clear selection')}
          disabled={busy}
          onClick={onClear}
        >
          {count === 1 ? t('1 selected') : t(`${count} selected`)}
        </button>
        {typeof onSelectPage === 'function' ? (
          <button
            type="button"
            className="od-cbtn"
            disabled={busy}
            title={t('Select all visible titles on this page')}
            onClick={onSelectPage}
          >
            {t('Select page')}
          </button>
        ) : null}
        <button
          type="button"
          className={`od-cbtn${favorited ? ' is-on' : ''}`}
          disabled={busy}
          aria-pressed={favorited}
          title={favorited ? t('Remove from favorites') : t('Add to favorites')}
          onClick={() => (favorited ? onUnfavorite?.() : onFavorite?.())}
        >
          {favorited ? t('Unfavorite') : t('Favorite')}
        </button>
        {typeof onWishlist === 'function' ? (
          <button
            type="button"
            className={`od-cbtn${wishlisted ? ' is-on' : ''}`}
            disabled={wishlistDisabled || (wishlisted && typeof onWishlistRemove !== 'function')}
            title={wishlistTitle}
            aria-pressed={wishlisted}
            onClick={() => (wishlisted ? onWishlistRemove?.() : onWishlist?.())}
          >
            {wishlisted ? t('Remove from wishlist') : t('Add to wishlist')}
          </button>
        ) : null}
        {typeof onPlayStatus === 'function' ? (
          <Popover
            label={t('Play status')}
            align="end"
            chromeless
            disabled={playStatusDisabled}
            title={playStatusTitle}
          >
            {({ close }) => (
              <div
                className="od-library-selection__menu od-pop__menu"
                role="group"
                aria-label={t('Play status')}
              >
                {BATCH_PLAY_STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value || 'clear'}
                    type="button"
                    className="od-cbtn"
                    disabled={playStatusDisabled}
                    title={playStatusTitle}
                    onClick={() => {
                      onPlayStatus(option.value)
                      close()
                    }}
                  >
                    {t(option.label)}
                  </button>
                ))}
              </div>
            )}
          </Popover>
        ) : null}
        <Popover label={t('More')} align="end" chromeless>
          {({ close }) => (
            <div
              className="od-library-selection__menu od-pop__menu"
              role="group"
              aria-label={t('More selection actions')}
            >
              <button
                type="button"
                className="od-cbtn"
                disabled={busy}
                title={t('Refresh store freshness for selected titles')}
                onClick={() => {
                  onRefreshFreshness?.()
                  close()
                }}
              >
                {t('Refresh freshness')}
              </button>
              {typeof onRefreshImages === 'function' ? (
                <button
                  type="button"
                  className="od-cbtn"
                  disabled={refreshImagesDisabled}
                  title={refreshImagesTitle}
                  onClick={() => {
                    onRefreshImages()
                    close()
                  }}
                >
                  {t('Refresh covers')}
                </button>
              ) : null}
            </div>
          )}
        </Popover>
      </div>
    </div>
  )
}
