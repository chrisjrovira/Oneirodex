const PER_PAGE_OPTIONS = [20, 50, 100, 200, 300, 400, 500, 1000]

/**
 * Library pager: how much you see on the left, where you are on the right.
 *
 * The four page controls used to be four separate buttons with the page
 * indicator wedged between Previous and Next — the navigation split in two by a
 * label, four detached buttons claiming more attention than the one sentence
 * that says where you are. The four moves are one segmented control now
 * (`gt-seg`, the same primitive as the view strips in bar two), and First/Last
 * stay next to Previous/Next rather than at the ends of the group: the pair you
 * reach for repeatedly should not be separated by the pair you use once.
 *
 * Per page and the indicator swapped ends. The setting leads because it is the
 * thing you reach for deliberately, and `Page 3 of 12` reads as the closing
 * status of the bar rather than its title — the same place a total sits at the
 * end of a table.
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

      <span className="page-info gt-pagination__page" aria-live="polite">
        {t('Page {page} of {pages}', { page, pages })}
      </span>
    </nav>
  )
}

export { PER_PAGE_OPTIONS }
