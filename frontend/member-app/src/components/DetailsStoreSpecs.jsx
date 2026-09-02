const OS_TABS = [
  ['windows', 'Windows'],
  ['mac', 'macOS'],
  ['linux', 'Linux'],
]

function flagCell(on) {
  return on ? 'Yes' : '—'
}

export function DetailsStoreSpecs({ storeSpecs }) {
  const reqs = storeSpecs?.system_requirements
  const languages = Array.isArray(storeSpecs?.languages) ? storeSpecs.languages : []
  const osRows = OS_TABS.filter(([key]) => {
    const block = reqs?.[key]
    return block && (block.minimum || block.recommended)
  })

  if (!osRows.length && !languages.length) {
    return null
  }

  return (
    <>
      {osRows.length ? (
        <section className="od-details-page__section">
          <h2>System requirements</h2>
          <p className="od-details-page__muted">
            From the store listing when this title was identified — not invented for ROM-only copies.
          </p>
          <div className="od-details-page__reqs">
            {osRows.map(([key, label]) => {
              const block = reqs[key]
              return (
                <div key={key} className="od-details-page__req-os">
                  <h3>{label}</h3>
                  {block.minimum ? (
                    <>
                      <h4>Minimum</h4>
                      <p className="od-details-page__req-text">{block.minimum}</p>
                    </>
                  ) : null}
                  {block.recommended ? (
                    <>
                      <h4>Recommended</h4>
                      <p className="od-details-page__req-text">{block.recommended}</p>
                    </>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {languages.length ? (
        <section className="od-details-page__section">
          <h2>Store languages</h2>
          <p className="od-details-page__muted">
            Interface / audio / subtitles from the store listing. ROM region chips above stay filename truth.
          </p>
          <div className="od-details-page__langs-wrap">
            <table className="od-details-page__langs">
              <thead>
                <tr>
                  <th scope="col">Language</th>
                  <th scope="col">Interface</th>
                  <th scope="col">Audio</th>
                  <th scope="col">Subtitles</th>
                </tr>
              </thead>
              <tbody>
                {languages.map((row) => (
                  <tr key={row.name}>
                    <th scope="row">{row.name}</th>
                    <td>{flagCell(row.interface)}</td>
                    <td>{flagCell(row.audio)}</td>
                    <td>{flagCell(row.subtitles)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  )
}
