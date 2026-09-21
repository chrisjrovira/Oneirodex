/**
 * The one line a thin seat gets instead of a companion action it cannot finish
 * (TC-3, UID-061). Same copy and `data-seat` hook as GameActionBar's thin
 * branch, so every surface says the same thing once rather than offering a
 * button that queues work on a machine this seat is not.
 */
export function ThinSeatNote({ what = 'download, install and update' }: { what?: string }) {
  return (
    <p className="od-details-page__muted od-thin-seat-note" role="status" data-seat="thin">
      Browse &amp; social seat — {what} happen on the desktop companion.
    </p>
  )
}
