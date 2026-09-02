import { useCallback, useEffect, useId, useState } from 'react'
import { getJson, putJson } from './adminApi'
import { PageStatus } from './PageStatus'
import { showToast } from './utils/toast'

const ENDPOINT = '/api/browser-player-settings'

/**
 * BP-1 NES Nostalgist flag. Lives on the Emulators page next to firmware
 * because that is where operators already decide how browser play boots.
 * Default stays off; the host has no save/load/rewind bar yet.
 */
export function BrowserPlayerPilot() {
  const checkboxId = useId()
  const [pilot, setPilot] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    return getJson(ENDPOINT)
      .then((data) => {
        setPilot(Boolean(data.nostalgist_nes_pilot))
      })
      .catch((err) => {
        setError(err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onToggle = useCallback(
    async (event) => {
      const next = event.target.checked
      setBusy(true)
      setError(null)
      try {
        const saved = await putJson(ENDPOINT, { nostalgist_nes_pilot: next })
        setPilot(Boolean(saved.nostalgist_nes_pilot))
        showToast(
          next
            ? 'NES Play will use the Nostalgist host (no save bar yet).'
            : 'NES Play uses the WebRetro room.',
          'success',
        )
      } catch (err) {
        setError(err)
        showToast(err.message || 'Could not save browser player settings.', 'error')
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  return (
    <section className="od-adminpage-panel" aria-labelledby="od-browser-player-heading">
      <h2 id="od-browser-player-heading" className="od-section-head__title">
        Browser play engine
      </h2>
      <p className="od-adminpage-lede">
        Play uses WebRetro. The NES Nostalgist host is optional, off by default,
        and still loads household cores and ROMs from this box. It does not yet
        have Save / Load / Rewind.
      </p>
      <PageStatus
        loading={loading}
        loadingMessage="Reading browser player settings…"
        error={error}
        onRetry={load}
        errorMessage="Could not read browser player settings."
        inline
      />
      {loading || error ? null : (
        <label htmlFor={checkboxId}>
          <input
            id={checkboxId}
            type="checkbox"
            checked={pilot}
            disabled={busy}
            onChange={onToggle}
          />{' '}
          NES Nostalgist pilot
        </label>
      )}
    </section>
  )
}
