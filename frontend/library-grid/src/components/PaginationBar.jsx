const PER_PAGE_OPTIONS = [20, 50, 100]

export function PaginationBar({
  page,
  pages,
  perPage,
  onPageChange,
  onPerPageChange,
}) {
  const hasPrevious = page > 1
  const hasNext = page < pages

  return (
    <nav className="pagination-controls" aria-label="Library pagination">
      <label>
        Per page{' '}
        <select
          aria-label="Games per page"
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
        aria-label="First page"
        disabled={!hasPrevious}
        onClick={() => onPageChange(1)}
      >
        First
      </button>
      <button
        type="button"
        aria-label="Previous page"
        disabled={!hasPrevious}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <span aria-live="polite">
        Page {page} of {pages}
      </span>
      <button
        type="button"
        aria-label="Next page"
        disabled={!hasNext}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
      <button
        type="button"
        aria-label="Last page"
        disabled={!hasNext}
        onClick={() => onPageChange(pages)}
      >
        Last
      </button>
    </nav>
  )
}
