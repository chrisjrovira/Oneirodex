import { useState } from 'react'
import { Button } from '@oneirodex/ui'
import { removeVrProfile, saveVrProfile, type VrProfile } from '../api/vr'
import './VrProfileEditor.css'

const KINDS: { id: VrProfile['kind']; label: string }[] = [
  { id: 'native', label: 'Ships a VR mode' },
  { id: 'injector', label: 'Community injector profile' },
  { id: 'flat', label: 'No VR — plays flat' },
]

/**
 * Librarian editor for the headset records (INSP-40). One record per kind;
 * the URL is the profile *page*. Nothing here downloads, installs or points
 * at a shim — the row exists so the ways-to-play line can say what is true
 * and link to where the community keeps it.
 */
export function VrProfileEditor({ gameUuid, initial }: { gameUuid: string; initial: VrProfile[] }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<VrProfile[]>(initial)
  const [kind, setKind] = useState<VrProfile['kind']>('injector')
  const [runtime, setRuntime] = useState<'' | 'openxr' | 'openvr'>('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function pick(next: VrProfile['kind']) {
    setKind(next)
    const row = rows.find((r) => r.kind === next)
    setRuntime(row?.runtime || '')
    setUrl(row?.profile_url || '')
    setNotes(row?.notes || '')
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await saveVrProfile(gameUuid, kind, {
        runtime: runtime || null,
        profile_url: url.trim() || null,
        notes: notes.trim() || null,
      })
      setRows(Array.isArray(data?.vr_profiles) ? data.vr_profiles : rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the VR record')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setError('')
    try {
      const data = await removeVrProfile(gameUuid, kind)
      setRows(
        Array.isArray(data?.vr_profiles) ? data.vr_profiles : rows.filter((r) => r.kind !== kind),
      )
      setRuntime('')
      setUrl('')
      setNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the VR record')
    } finally {
      setBusy(false)
    }
  }

  const existing = rows.find((r) => r.kind === kind)

  if (!open) {
    return (
      <Button
        type="button"
        variant="quiet"
        size="sm"
        className="od-vrprof__toggle"
        onClick={() => {
          setOpen(true)
          pick(kind)
        }}
      >
        {rows.length ? 'Edit headset record' : 'Add headset record'}
      </Button>
    )
  }

  return (
    <form className="od-vrprof" onSubmit={save} aria-label="Headset record">
      <p className="od-vrprof__lede">
        A record and a link: how this title plays in a headset and where the community keeps its
        profile. Oneirodex never ships, installs or points at a shim.
      </p>
      <label>
        Kind
        <select value={kind} onChange={(e) => pick(e.target.value as VrProfile['kind'])}>
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
              {rows.some((r) => r.kind === k.id) ? ' (recorded)' : ''}
            </option>
          ))}
        </select>
      </label>
      <label>
        Runtime
        <select
          value={runtime}
          onChange={(e) => setRuntime(e.target.value as '' | 'openxr' | 'openvr')}
        >
          <option value="">Unknown</option>
          <option value="openxr">OpenXR</option>
          <option value="openvr">OpenVR / SteamVR</option>
        </select>
      </label>
      <label>
        Profile page (http(s) only)
        <input
          type="url"
          value={url}
          maxLength={2048}
          placeholder="https://…"
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>
      <label>
        Notes
        <input
          type="text"
          value={notes}
          maxLength={2000}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      {error ? <p className="od-vrprof__error">{error}</p> : null}
      <div className="od-vrprof__actions">
        <Button type="submit" variant="primary" size="sm" disabled={busy}>
          {busy ? 'Saving…' : existing ? 'Update record' : 'Save record'}
        </Button>
        {existing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void remove()}
          >
            Remove
          </Button>
        ) : null}
        <Button type="button" variant="quiet" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
    </form>
  )
}
