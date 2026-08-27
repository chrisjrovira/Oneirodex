// Toasts on every mutation (GT-B25). Outcomes were reported inline only,
// which is easy to miss when the triggering control has scrolled away.
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { csrfHeaders, csrfToken, postJson } from './adminApi'
import { PageStatus } from './PageStatus'
import { MetricStrip } from './opsWidgets'
import { showToast } from './utils/toast'
import './OpenPathModal.css'

/**
 * Firmware / BIOS management for WebRetro cores (GT-B2 · UID-007).
 *
 * Product stance (locked): Oneirodex never downloads or bundles BIOS. Public
 * installs get an upload box; local installs can also mount EMULATOR_BIOS_PATH
 * or scan a folder the operator already holds. There is deliberately no
 * "fetch BIOS" affordance anywhere in this component.
 *
 * Mounted into the Jinja Emulators page rather than replacing it.
 */

const ENDPOINT = '/api/emulator-bios'

/** Human core names — the API returns libretro core ids. */
const CORE_LABELS = {
  mednafen_psx_hw: 'PlayStation',
  opera: '3DO',
  neocd: 'Neo Geo CD',
  yabause: 'Saturn',
  genesis_plus_gx: 'Sega CD',
  flycast: 'Dreamcast',
  pcsx2: 'PlayStation 2',
  melonds: 'Nintendo DS',
  mgba: 'Game Boy Advance',
  handy: 'Atari Lynx',
  gearcoleco: 'ColecoVision',
  freeintv: 'Intellivision',
  o2em: 'Odyssey²',
  mednafen_pce: 'PC Engine CD',
  mednafen_pce_fast: 'PC Engine',
  mednafen_supergrafx: 'SuperGrafx',
  puae: 'Amiga',
  cap32: 'Amstrad CPC / GX4000',
  prosystem: 'Atari 7800',
  a5200: 'Atari 5200',
  freechaf: 'Fairchild Channel F',
  crvision: 'VTech CreatiVision',
  citra: 'Nintendo 3DS',
  vita3k: 'PlayStation Vita',
  nestopia: 'NES / Famicom Disk System',
  dolphin: 'GameCube / Wii',
  snes9x: 'SNES',
  mupen64plus_next: 'Nintendo 64',
  parallel_n64: 'Nintendo 64 (ParaLLEl)',
  gearsystem: 'Master System / SG-1000',
  virtualjaguar: 'Atari Jaguar',
  vice_x64: 'Commodore 64',
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

async function copyText(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', '')
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  document.body.removeChild(input)
}

function versionChoice(version) {
  return version.digest || (version.paths && version.paths[0]) || ''
}

function FirmwareMissingDialog({ open, markdown, onClose }) {
  const titleId = useId()
  const closeRef = useRef(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    setCopied(false)
    closeRef.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="gt-open-path"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div className="gt-open-path__panel" onClick={(event) => event.stopPropagation()}>
        <div className="gt-open-path__toolbar">
          <h2 id={titleId} className="gt-open-path__title">
            Missing firmware
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="gt-open-path__close"
            onClick={onClose}
            aria-label="Dismiss missing firmware report"
          >
            ×
          </button>
        </div>
        <p className="gt-open-path__reason">
          Markdown you can paste into notes. Oneirodex never downloads BIOS.
        </p>
        <textarea
          className="gt-input"
          readOnly
          rows={16}
          value={markdown}
          aria-label="Missing firmware report (markdown)"
        />
        <div className="gt-open-path__actions">
          <button
            type="button"
            className="gt-btn gt-btn--primary"
            onClick={() => {
              void copyText(markdown)
                .then(() => setCopied(true))
                .catch(() => setCopied(false))
            }}
          >
            Copy markdown
          </button>
          <button type="button" className="gt-btn" onClick={onClose}>
            Close
          </button>
        </div>
        {copied ? <p className="gt-open-path__status">Copied to clipboard</p> : null}
      </div>
    </div>
  )
}

export function EmulatorFirmwarePanel() {
  const [files, setFiles] = useState([])
  const [cores, setCores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(null)
  const [sourceFolder, setSourceFolder] = useState('')
  const [volumeMarkdown, setVolumeMarkdown] = useState('')
  const [plan, setPlan] = useState(null)
  const [selections, setSelections] = useState({})
  const [skipped, setSkipped] = useState(() => new Set())
  const [overwrite, setOverwrite] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const inputRef = useRef(null)

  const reportMarkdown = plan?.missing_markdown || volumeMarkdown

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
      setVolumeMarkdown(typeof data.missing_markdown === 'string' ? data.missing_markdown : '')
      if (typeof data.import_source === 'string' && data.import_source) {
        setSourceFolder((prev) => prev || data.import_source)
      }
    } catch (err) {
      setError(err.message || 'Could not read the firmware volume.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const applyPlan = useCallback((next) => {
    const picks = {}
    const skip = new Set()
    for (const match of next.matches || []) {
      picks[match.name] = match.chosen || ''
      if (match.already) skip.add(match.name)
    }
    setPlan(next)
    setSelections(picks)
    setSkipped(skip)
  }, [])

  const scanCollection = useCallback(async () => {
    setBusy('scan')
    setError(null)
    setNotice(null)
    try {
      const data = await postJson(`${ENDPOINT}/scan`, { source: sourceFolder })
      applyPlan(data)
      setReportOpen(true)
    } catch (err) {
      setError(err.message || 'Could not scan that folder.')
      showToast(err.message || 'Firmware scan failed.', 'error')
    } finally {
      setBusy(null)
    }
  }, [applyPlan, sourceFolder])

  const installMatching = useCallback(async () => {
    setBusy('install')
    setError(null)
    setNotice(null)
    try {
      const data = await postJson(`${ENDPOINT}/install`, {
        source: sourceFolder,
        selections,
        skipped: [...skipped],
        overwrite,
      })
      applyPlan(data)
      const copied = Number(data.copied_count) || 0
      const summary = copied
        ? `Installed ${copied} firmware file${copied === 1 ? '' : 's'} from the collection.`
        : 'Nothing new to install — already on the volume or skipped.'
      setNotice(summary)
      showToast(summary, 'success')
      setReportOpen(true)
      await load()
    } catch (err) {
      setError(err.message || 'Could not install firmware from that folder.')
      showToast(err.message || 'Firmware install failed.', 'error')
    } finally {
      setBusy(null)
    }
  }, [applyPlan, load, overwrite, selections, skipped, sourceFolder])

  const upload = useCallback(
    async (file) => {
      if (!file) return
      setBusy('upload')
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
          headers: csrfHeaders(),
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
        setBusy(null)
      }
    },
    [load],
  )

  const ready = cores.filter((c) => c.ready).length
  const missing = cores.length - ready
  const working = Boolean(busy)
  const busyLabel =
    busy === 'scan' ? 'Scanning…' : busy === 'install' ? 'Installing…' : busy === 'upload' ? 'Uploading…' : null

  return (
    <section className="gt-adminpage-panel" aria-labelledby="gt-firmware-heading">
      <h2 id="gt-firmware-heading" className="gt-section-head__title">
        Firmware / BIOS
      </h2>
      <p className="gt-adminpage-lede">
        Some cores need system files you legally own. Upload one file, scan a folder
        of dumps you already have, or mount them at <code>EMULATOR_BIOS_PATH</code>.
        Oneirodex never downloads BIOS for you.
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

      <h3 className="gt-section-head__title">Install from a collection</h3>
      <p className="gt-adminpage-lede">
        Point at a folder on this server. Subfolders are searched too. Matching
        names are offered for every system the service supports; if two dumps share
        a filename, pick which one that system should use. Cores read one file per
        name from the firmware root, so a shared filename is one dump for every
        system that uses it.
      </p>
      <label className="gt-adminpage-lede" htmlFor="gt-firmware-source">
        Firmware collection folder
      </label>
      <input
        id="gt-firmware-source"
        className="gt-input"
        type="text"
        value={sourceFolder}
        disabled={working}
        placeholder="Folder on this server (searched recursively)"
        onChange={(event) => setSourceFolder(event.target.value)}
      />
      <div className="gt-btn-bar">
        <button
          type="button"
          className="gt-btn gt-btn--primary"
          disabled={working || !sourceFolder.trim()}
          onClick={() => void scanCollection()}
        >
          Scan collection
        </button>
        <button
          type="button"
          className="gt-btn"
          disabled={working || !sourceFolder.trim()}
          onClick={() => void installMatching()}
        >
          Install matching firmware
        </button>
        <button
          type="button"
          className="gt-btn"
          disabled={working || !reportMarkdown}
          onClick={() => setReportOpen(true)}
        >
          Show missing report
        </button>
        <label>
          <input
            type="checkbox"
            checked={overwrite}
            disabled={working}
            onChange={(event) => setOverwrite(event.target.checked)}
          />{' '}
          Replace files already on the volume
        </label>
      </div>

      <div className="gt-btn-bar">
        <input
          ref={inputRef}
          className="gt-input"
          type="file"
          aria-label="Firmware file"
          disabled={working}
          onChange={(event) => upload(event.target.files?.[0])}
        />
        {busyLabel ? (
          <span role="status" aria-busy="true">
            {busyLabel}
          </span>
        ) : null}
      </div>

      {/* `Uploading…` / `Scanning…` / `Installing…` and `notice` stay
          hand-rolled on purpose: the first is inline feedback on one control,
          the second is a success message, and PageStatus models neither. */}
      <PageStatus error={error} onRetry={load} />

      {notice ? (
        <p className="gt-adminpage-status" role="status">
          {notice}
        </p>
      ) : null}

      <PageStatus loading={loading} loadingMessage="Reading firmware volume…" />

      {!loading && !error && plan ? (
        <>
          <h3 className="gt-section-head__title">Matching dumps in the collection</h3>
          {(plan.matches || []).length === 0 ? (
            <p className="gt-empty">
              No filenames this service asks for were in that folder. The missing
              report lists what to add.
            </p>
          ) : (
            <ul className="gt-list">
              {(plan.matches || []).map((match) => {
                const systems = (match.systems || [])
                  .map((row) => row.label)
                  .join(', ')
                const included = !skipped.has(match.name)
                const versions = match.versions || []
                const conflict = versions.filter((row) => row.digest).length > 1
                return (
                  <li key={match.name} className="gt-list__row">
                    <label>
                      <input
                        type="checkbox"
                        checked={included}
                        disabled={working}
                        onChange={(event) => {
                          setSkipped((prev) => {
                            const next = new Set(prev)
                            if (event.target.checked) next.delete(match.name)
                            else next.add(match.name)
                            return next
                          })
                        }}
                      />{' '}
                      Install <code>{match.name}</code>
                      {match.already ? ' (already on the volume)' : ''}
                    </label>
                    {systems ? (
                      <p className="gt-error__detail">Systems: {systems}</p>
                    ) : null}
                    {match.note ? <p className="gt-error__detail">{match.note}</p> : null}
                    {conflict ? (
                      <fieldset>
                        <legend>Which dump for {match.name}</legend>
                        {versions.map((version) => {
                          const choice = versionChoice(version)
                          const id = `gt-fw-${match.name}-${choice}`
                          return (
                            <label key={choice} htmlFor={id}>
                              <input
                                id={id}
                                type="radio"
                                name={`gt-fw-${match.name}`}
                                value={choice}
                                checked={selections[match.name] === choice}
                                disabled={working || !included}
                                onChange={() => {
                                  setSelections((prev) => ({ ...prev, [match.name]: choice }))
                                }}
                              />{' '}
                              {formatBytes(version.size)} · {version.digest ? version.digest.slice(0, 12) : 'single copy'}
                              {version.count > 1 ? ` · ${version.count} copies` : ''}
                              {version.paths?.length
                                ? ` · ${(version.paths || []).join(', ')}`
                                : ''}
                            </label>
                          )
                        })}
                      </fieldset>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </>
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

      <FirmwareMissingDialog
        open={reportOpen}
        markdown={reportMarkdown}
        onClose={() => setReportOpen(false)}
      />
    </section>
  )
}
