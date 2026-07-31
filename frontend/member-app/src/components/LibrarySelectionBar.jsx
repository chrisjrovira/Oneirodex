import { BATCH_PLAY_STATUS_OPTIONS } from '../api/batchActions'
import './LibrarySelectionBar.css'

const CLEAR_STATUS_TOKEN = '__clear__'

/**
 * Sticky compact bar shown while Library multi-select is non-empty.
 */
export function LibrarySelectionBar({
  count,
  busy = false,
  wishlistAvailable = true,
  playStatusAvailable = true,
  refreshImagesAvailable = true,
  onFavorite,
  onUnfavorite,
  onRefreshFreshness,
  onRefreshImages,
  onWishlist,
  onPlayStatus,
  onSelectPage,
  onClear,
  t = (s) => s,
}) {
  if (!count) {
    return null
  }

  const wishlistDisabled = busy || !wishlistAvailable
  const playStatusDisabled = busy || !playStatusAvailable
  const refreshImagesDisabled = busy || !refreshImagesAvailable
  const wishlistTitle = wishlistAvailable
    ? t('Add selected titles to wishlist')
    : t('Batch wishlist is not available yet')
  const playStatusTitle = playStatusAvailable
    ? t('Set play status for selected titles')
    : t('Batch play status is not available yet')
  const refreshImagesTitle = refreshImagesAvailable
    ? t('Refresh covers for selected titles (max 20)')
    : t('Batch cover refresh is not available yet')

  const handlePlayStatusChange = (event) => {
    const raw = event.target.value
    event.target.value = ''
    if (!raw || typeof onPlayStatus !== 'function') {
      return
    }
    const status = raw === CLEAR_STATUS_TOKEN ? '' : raw
    onPlayStatus(status)
  }

  return (
    <div
      className="gt-library-selection"
      role="toolbar"
      aria-label={t('Library selection actions')}
      data-selection-count={count}
    >
      <span className="gt-library-selection__count" aria-live="polite">
        {count === 1 ? t('1 selected') : t(`${count} selected`)}
      </span>
      <div className="gt-library-selection__actions">
        {typeof onSelectPage === 'function' ? (
          <button
            type="button"
            className="gt-btn gt-btn--secondary"
            disabled={busy}
            title={t('Select all visible titles on this page')}
            onClick={onSelectPage}
          >
            {t('Select page')}
          </button>
        ) : null}
        <button
          type="button"
          className="gt-btn gt-btn--secondary"
          disabled={busy}
          onClick={onFavorite}
        >
          {t('Favorite')}
        </button>
        <button
          type="button"
          className="gt-btn gt-btn--secondary"
          disabled={busy}
          onClick={onUnfavorite}
        >
          {t('Unfavorite')}
        </button>
        {typeof onWishlist === 'function' ? (
          <button
            type="button"
            className="gt-btn gt-btn--secondary"
            disabled={wishlistDisabled}
            title={wishlistTitle}
            onClick={onWishlist}
          >
            {t('Add to wishlist')}
          </button>
        ) : null}
        {typeof onPlayStatus === 'function' ? (
          <label className="gt-library-selection__status">
            <span className="gt-library-selection__status-label">{t('Play status')}</span>
            <select
              className="gt-library-selection__status-select"
              aria-label={t('Play status')}
              disabled={playStatusDisabled}
              title={playStatusTitle}
              defaultValue=""
              onChange={handlePlayStatusChange}
            >
              <option value="" disabled>
                {t('Play status')}
              </option>
              {BATCH_PLAY_STATUS_OPTIONS.map((option) => (
                <option
                  key={option.value || CLEAR_STATUS_TOKEN}
                  value={option.value === '' ? CLEAR_STATUS_TOKEN : option.value}
                >
                  {t(option.label)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <details className="gt-library-selection__more">
          <summary className="gt-btn gt-btn--secondary">{t('More')}</summary>
          <div className="gt-library-selection__more-menu" role="group" aria-label={t('More selection actions')}>
            <button
              type="button"
              className="gt-btn gt-btn--secondary"
              disabled={busy}
              title={t('Refresh store freshness for selected titles')}
              onClick={onRefreshFreshness}
            >
              {t('Refresh freshness')}
            </button>
            {typeof onRefreshImages === 'function' ? (
              <button
                type="button"
                className="gt-btn gt-btn--secondary"
                disabled={refreshImagesDisabled}
                title={refreshImagesTitle}
                onClick={onRefreshImages}
              >
                {t('Refresh covers')}
              </button>
            ) : null}
          </div>
        </details>
        <button
          type="button"
          className="gt-btn"
          disabled={busy}
          onClick={onClear}
        >
          {t('Clear selection')}
        </button>
      </div>
    </div>
  )
}
