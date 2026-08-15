// Toasts on every mutation (GT-B25). Outcomes were reported inline only,
// which is easy to miss when the triggering control has scrolled away.
import { useCallback, useEffect, useRef, useState } from 'react'
import { csrfToken } from './adminApi'
import { MetricStrip } from './opsWidgets'
import { showToast } from './utils/toast'

/**
 * Firmware / BIOS management for WebRetro cores (GT-B2 · UID-007).
 *
 * The backend has had GET/POST /api/emulator-bios since the play-honesty wave,
 * but the admin Emulators page never grew a UI for it — the template contained
 * no reference to firmware at all, so the only way to supply BIOS was to drop
 * files onto the volume by hand.
 *
 * Product stance (locked): GameTheca never downloads or bundles BIOS. Public
 * installs get an upload box; local installs can also mount EMULATOR_BIOS_PATH.
 * There is deliberately no "fetch BIOS" affordance anywhere in this component.
 *
 * Mounted into the Jinja Emulators page rather than replacing it, matching the
 * existing propose-leaf / import-leaf hybrid pattern, so the profile forms on
 * that page keep working untouched.
 */

const ENDPOINT = '/api/emulator-bios'

/** Human core names — the API returns libretro core ids. */
const CORE_LABELS = {
  mednafen_psx_hw: 'PlayStation',
  opera: '3DO',
  neocd: 'Neo Geo CD',
  yabause: 'Saturn',
  genesis_plus_gx: 'Sega CD',
}

export function coreLabel(core) {
  return CORE_LABELS[core] || core
}

export function formatBytes(size) {
  if (size === null || size === undefined || size === '') return 'n/a'
  const n = Number(size)
  if (!Number.isFinite(n) || n < 0) return 'n/a'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** Pull the human sentence out of either envelope shape (see GT-B1). */
export async function readError(response, fallback) {
  try {
    const body = await response.json()
    const text = body?.error || body?.message
    if (typeof text === 'string' && text.trim()) return text.trim()
  } catch {
    /* non-JSON error body — fall through */
  }
  return fallback
}

export function EmulatorFirmwarePanel() {
  const [files, setFiles] = useState([])
  const [cores, setCores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(ENDPOINT, { credentials: 'same-origin' })
      if (!response.ok) {
        throw new Error(await readError(response, 'Could not read the firmware volume.'))
      }
      const data = await response.json()
      setFiles(Array.isArray(data.files) ? data.files : [])
      setCores(Array.isArray(data.cores) ? data.cores : [])
    } catch (err) {
      setError(err.message || 'Could not read the firmware volume.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const upload = useCallback(
    async (file) => {
      if (!file) return
      setUploading(true)
      setError(null)
      setNotice(null)
      try {
        const form = new FormData()
        form.append('file', file)
        // CSRFProtect is app-wide, so an upload without a token is rejected
        // with 400 before the route ever sees the file — which is what made
        // firmware upload look broken. Sent both ways, as the other FormData
        // upload in this app does: the header for CSRFProtect, and the field
        // for any surface that reads it out of the form.
        form.append('csrf_token', csrfToken())
        const response = await fetch(ENDPOINT, {
          method: 'POST',
          body: form,
          credentials: 'same-origin',
          headers: { 'X-CSRFToken': csrfToken() },
        })
        if (!response.ok) {
          throw new Error(await readError(response, 'Upload failed.'))
        }
        setNotice(`${file.name} added to the firmware volume.`)
        showToast(`${file.name} added to the firmware volume.`, 'success')
        if (inputRef.current) inputRef.current.value = ''
        await load()
      } catch (err) {
        setError(err.message || 'Upload failed.')
        showToast(err.message || 'Firmware upload failed.', 'error')
      } finally {
        setUploading(false)
      }
    },
    [load],
  )

  const ready = cores.filter((c) => c.ready).length
  const missing = cores.length - ready

  return (
    <section className="gt-adminpage-panel" aria-labelledby="gt-firmware-heading">
      <h2 id="gt-firmware-heading" className="gt-section-head__title">
        Firmware / BIOS
      </h2>
      <p className="gt-adminpage-lede">
        Some cores need system files you legally own. Upload them here, or mount them at{' '}
        <code>EMULATOR_BIOS_PATH</code>. GameTheca never downloads BIOS for you.
      </p>

      {!loading && cores.length > 0 ? (
        <MetricStrip
          label="Firmware coverage"
          items={[
            {
              id: 'ready',
              label: 'Cores ready',
              value: ready,
              hint: `of ${cores.length}`,
              tone: ready === cores.length ? 'good' : 'info',
            },
            {
              id: 'missing',
              label: 'Cores missing files',
              value: missing,
              hint: missing > 0 ? 'play falls back' : 'all covered',
              tone: missing > 0 ? 'warning' : 'good',
            },
            {
              id: 'files',
              label: 'Files on volume',
              value: files.length,
              hint: 'uploaded',
              tone: 'info',
            },
          ]}
        />
      ) : null}

      <div className="gt-btn-bar" style={{ margin: 'var(--gt-space-4) 0' }}>
        <input
          ref={inputRef}
          className="gt-input"
          type="file"
          aria-label="Firmware file"
          disabled={uploading}
          onChange={(event) => upload(event.target.files?.[0])}
        />
        {uploading ? (
          <span role="status" aria-busy="true">
            Uploading…
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="gt-error" role="alert">
          <p className="gt-error__message">{error}</p>
          <button type="button" className="gt-btn gt-btn--sm" onClick={load}>
            Try again
          </button>
        </div>
      ) : null}

      {notice ? (
        <p className="gt-adminpage-status" role="status">
          {notice}
        </p>
      ) : null}

      {loading ? (
        <p role="status" aria-busy="true">
          Reading firmware volume…
        </p>
      ) : null}

      {!loading && !error ? (
        <>
          <h3 className="gt-section-head__title">Cores</h3>
          {cores.length === 0 ? (
            <p className="gt-empty">No cores declare firmware requirements.</p>
          ) : (
            <ul className="gt-list">
              {cores.map((core) => (
                <li key={core.core} className="gt-list__row">
                  <strong>{coreLabel(core.core)}</strong>{' '}
                  <span>
                    {core.ready
                      ? 'ready'
                      : core.misplaced?.length
                        ? 'files found, but in a subfolder'
                        : 'missing system files'}
                  </span>
                  <p className="gt-error__detail">
                    Accepts: {(core.required || []).join(', ')}
                    {core.present?.length ? ` · present: ${core.present.join(', ')}` : ''}
                  </p>
                  {/* "Missing" and "present but in the wrong place" are different
                      problems with different fixes — download it, versus move it
                      up one level. Reporting both as missing is what made a full
                      firmware volume look empty (UID-007). */}
                  {core.misplaced?.length ? (
                    <p className="gt-error__detail">
                      Move to the firmware root to load:{' '}
                      {core.misplaced.map((f) => `${f.subdir}/${f.name}`).join(', ')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <h3 className="gt-section-head__title">Files on volume</h3>
          {files.length === 0 ? (
            <p className="gt-empty">
              No firmware found on the volume. Cores that need it will stay
              unavailable for browser play. Files in subfolders are listed here
              too — if you copied a set in and see nothing, check the path the
              volume is actually mounted at.
            </p>
          ) : (
            <ul className="gt-list">
              {files.map((file) => (
                <li key={`${file.subdir}/${file.name}`} className="gt-list__row">
                  <code>{file.subdir ? `${file.subdir}/${file.name}` : file.name}</code>{' '}
                  <span>{formatBytes(file.size)}</span>
                  {file.loadable === false ? (
                    <span className="gt-badge gt-badge--warn">subfolder</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  )
}
