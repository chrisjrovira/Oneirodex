const PER_PAGE_OPTIONS = [20, 50, 100, 200, 300, 400, 500, 1000]

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
      <button
        type="button"
        className="btn-pagination"
        aria-label={t('First')}
        disabled={!hasPrevious}
        onClick={() => onPageChange(1)}
      >
        {t('First')}
      </button>
      <button
        type="button"
        className="btn-pagination"
        aria-label={t('Previous')}
        disabled={!hasPrevious}
        onClick={() => onPageChange(page - 1)}
      >
        {t('Previous')}
      </button>
      <span className="page-info" aria-live="polite">
        {t('Page {page} of {pages}', { page, pages })}
      </span>
      <button
        type="button"
        className="btn-pagination"
        aria-label={t('Next')}
        disabled={!hasNext}
        onClick={() => onPageChange(page + 1)}
      >
        {t('Next')}
      </button>
      <button
        type="button"
        className="btn-pagination"
        aria-label={t('Last')}
        disabled={!hasNext}
        onClick={() => onPageChange(pages)}
      >
        {t('Last')}
      </button>
    </nav>
  )
}

export { PER_PAGE_OPTIONS }
