import type { MissingCoverGame } from './artStudioModel'
import { Button } from '@oneirodex/ui'

/** Batch placeholder covers for games with no art. */
export function ArtStudioBatch({
  batchApplyPlaceholders,
  batchLog,
  batchOpen,
  batchSelected,
  busy,
  loadMissing,
  missingCovers,
  setBatchOpen,
  toggleBatch,
}: {
  batchApplyPlaceholders: () => Promise<void>
  batchLog: string
  batchOpen: boolean
  batchSelected: Set<string>
  busy: string
  loadMissing: () => Promise<void>
  missingCovers: MissingCoverGame[]
  setBatchOpen: (update: boolean | ((open: boolean) => boolean)) => void
  toggleBatch: (uuid: string) => void
}) {
  return (
    <section className="od-admin-panel od-art-studio-batch">
      <button
        type="button"
        className="od-art-studio-batch__toggle"
        aria-expanded={batchOpen}
        onClick={() => setBatchOpen((o) => !o)}
      >
        <h2 className="od-admin-panel-title">Batch placeholders for no-cover titles</h2>
        <span aria-hidden="true">{batchOpen ? '▾' : '▸'}</span>
      </button>
      {batchOpen ? (
        <>
          <p className="od-admin-lede">
            Loads the library health sample, then applies procedural covers for checked titles via{' '}
            <code>POST /admin/api/art-studio/batch-generate</code>, falling back to{' '}
            <code>covers/batch/apply</code> (<code>policy=generate_only</code>) then per-title
            generate/apply.
          </p>
          <div className="od-admin-actions-row">
            <Button type="button" disabled={busy === 'missing'} onClick={loadMissing}>
              Load no-cover list
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={busy === 'batch' || !batchSelected.size}
              onClick={batchApplyPlaceholders}
            >
              Apply placeholders ({batchSelected.size})
            </Button>
          </div>
          {missingCovers.length ? (
            <ul className="od-art-studio__batch-list">
              {missingCovers.map((g) => (
                <li key={g.uuid}>
                  <label>
                    <input
                      type="checkbox"
                      checked={batchSelected.has(g.uuid)}
                      onChange={() => toggleBatch(g.uuid)}
                    />
                    {g.name} <code className="od-mono">{g.uuid}</code>
                  </label>
                </li>
              ))}
            </ul>
          ) : null}
          {batchLog ? (
            <pre className="od-art-studio__batch-log" aria-live="polite">
              {batchLog}
            </pre>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
