const PER_PAGE_OPTIONS = [20, 50, 100, 200, 300, 400, 500, 1000]

/**
 * Library pager: how much you see on the left, where you are on the right.
 *
 * The four page controls used to be four separate buttons with the page
 * indicator wedged between Previous and Next — the navigation split in two by a
 * label, four detached buttons claiming more attention than the one sentence
 * that says where you are. First/Last stay next to Previous/Next rather than at
 * the ends of the group: the pair you reach for repeatedly should not be
 * separated by the pair you use once. The four moves share one ARIA group
 * (`od-seg`) but are not a boxed segmented control.
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
    <nav className="pagination-controls od-pagination" aria-label="Game Catalog pagination">
      {/* Control first, label after — "50 per page" is how the setting reads
          aloud, and the number is the part you look for when scanning the bar.
          Label-then-control put a word where the eye expects the value. */}
      <label className="od-pagination__perpage">
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
        <span className="od-pagination__label">{t('Per page')}</span>
      </label>

      <div className="od-seg od-pagination__moves" role="group" aria-label={t('Pages')}>
        {moves.map((move) => (
          <button
            key={move.id}
            type="button"
            className="od-seg__item btn-pagination"
            aria-label={move.label}
            disabled={!move.enabled}
            onClick={() => onPageChange(move.to)}
          >
            {move.label}
          </button>
        ))}
      </div>

      <span className="page-info od-pagination__page" aria-live="polite">
        {t('Page {page} of {pages}', { page, pages })}
      </span>
    </nav>
  )
}

export { PER_PAGE_OPTIONS }
