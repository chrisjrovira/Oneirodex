const PER_PAGE_OPTIONS = [20, 50, 100, 200, 300, 400, 500, 1000]

/**
 * Library pager: where you are on the left, how much you see on the right.
 *
 * The four page controls used to be four separate buttons with the page
 * indicator wedged between Previous and Next, and Per page led the whole bar —
 * so the first thing you read was a setting, the navigation was split in two by
 * a label, and four detached buttons claimed more attention than the one
 * sentence that says where you are.
 *
 * Now: the indicator reads first, the four moves are one segmented control
 * (`gt-seg`, the same primitive as the view strips in bar two), and Per page
 * sits at the far right where a setting belongs. First/Last stay next to
 * Previous/Next rather than at the ends of the group — the pair you reach for
 * repeatedly should not be separated by the pair you use once.
 */
export function PaginationBar({
  page,
  pages,
  perPage,
  onPageChange,
  onPerPageChange,
  t = (key, vars) => {
    if (key === 'Page {page} of {pages}') {
      return `Page ${vars.page} of ${vars.pages}`
    }
    return key
  },
}) {
  const hasPrevious = page > 1
  const hasNext = page < pages

  const moves = [
    { id: 'first', label: t('First'), to: 1, enabled: hasPrevious },
    { id: 'previous', label: t('Previous'), to: page - 1, enabled: hasPrevious },
    { id: 'next', label: t('Next'), to: page + 1, enabled: hasNext },
    { id: 'last', label: t('Last'), to: pages, enabled: hasNext },
  ]

  return (
    <nav className="pagination-controls gt-pagination" aria-label="Library pagination">
      <span className="page-info gt-pagination__page" aria-live="polite">
        {t('Page {page} of {pages}', { page, pages })}
      </span>

      <div className="gt-seg gt-pagination__moves" role="group" aria-label={t('Pages')}>
        {moves.map((move) => (
          <button
            key={move.id}
            type="button"
            className="gt-seg__item btn-pagination"
            aria-label={move.label}
            disabled={!move.enabled}
            onClick={() => onPageChange(move.to)}
          >
            {move.label}
          </button>
        ))}
      </div>

      <label className="gt-pagination__perpage">
        <span className="gt-pagination__label">{t('Per page')}</span>
        <select
          className="dropdown-perpage"
          aria-label={t('Per page')}
          value={perPage}
          onChange={(event) => onPerPageChange(Number(event.target.value))}
        >
          {PER_PAGE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          {!PER_PAGE_OPTIONS.includes(perPage) && (
            <option value={perPage}>{perPage}</option>
          )}
        </select>
      </label>
    </nav>
  )
}

export { PER_PAGE_OPTIONS }
