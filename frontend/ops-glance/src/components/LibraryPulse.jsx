export function LibraryPulse({ library }) {
  return (
    <section className="ops-panel">
      <h2>Library pulse</h2>
      {!library ? <p>Library data unavailable.</p> : (
        <ul>
          <li>Libraries: {library.libraries ?? 0}</li>
          <li>Games: {library.games ?? 0}</li>
          <li>Unmatched folders: {library.unmatched_folders ?? 0}</li>
          <li>Open download requests: {library.download_requests_open ?? 0}</li>
        </ul>
      )}
    </section>
  )
}
