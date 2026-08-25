import { useEffect, useState } from 'react'
import { PageStatus } from './PageStatus'
import { deleteJson, getJson, postJson, putJson } from './adminApi'

const EMPTY_FORM = {
  name: '',
  preferred_groups: '',
  preferred_patterns: '',
  blocked_groups: '',
  excluded_terms: '',
  min_size_mb: '',
  max_size_mb: '',
  prefer_repack: true,
}

function splitList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function formFromProfile(profile) {
  const p = profile || {}
  return {
    name: p.name || '',
    preferred_groups: (p.preferred_groups || []).join(', '),
    preferred_patterns: (p.preferred_patterns || []).join(', '),
    blocked_groups: (p.blocked_groups || []).join(', '),
    excluded_terms: (p.excluded_terms || []).join(', '),
    min_size_mb: p.min_size_mb ?? '',
    max_size_mb: p.max_size_mb ?? '',
    prefer_repack: p.prefer_repack !== false,
  }
}

function bodyFromForm(form) {
  return {
    name: String(form.name || '').trim() || 'Profile',
    preferred_groups: splitList(form.preferred_groups),
    preferred_patterns: splitList(form.preferred_patterns),
    blocked_groups: splitList(form.blocked_groups),
    excluded_terms: splitList(form.excluded_terms),
    min_size_mb: form.min_size_mb === '' || form.min_size_mb == null ? null : form.min_size_mb,
    max_size_mb: form.max_size_mb === '' || form.max_size_mb == null ? null : form.max_size_mb,
    prefer_repack: Boolean(form.prefer_repack),
  }
}

export function QualityProfilesPage() {
  const [profiles, setProfiles] = useState([])
  const [activeId, setActiveId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [status, setStatus] = useState('Loading…')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [probeTitle, setProbeTitle] = useState('')
  const [probeResult, setProbeResult] = useState(null)

  function applyStore(data, preferId) {
    const list = Array.isArray(data?.profiles) ? data.profiles : []
    const nextActive = data?.active_id || ''
    setProfiles(list)
    setActiveId(nextActive)
    const nextSelected =
      (preferId && list.some((p) => p.id === preferId) && preferId) ||
      (selectedId && list.some((p) => p.id === selectedId) && selectedId) ||
      nextActive ||
      list[0]?.id ||
      ''
    setSelectedId(nextSelected)
    const selected = list.find((p) => p.id === nextSelected) || null
    setForm(formFromProfile(selected))
    const activeName = list.find((p) => p.id === nextActive)?.name || ''
    setStatus(
      activeName
        ? `Active: ${activeName} · editing ${selected?.name || '—'}`
        : list.length
          ? 'Loaded'
          : 'No profiles yet',
    )
  }

  async function reload(preferId) {
    const data = await getJson('/api/quality-profiles')
    applyStore(data, preferId)
    return data
  }

  useEffect(() => {
    let cancelled = false
    reload()
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load')
          setStatus(err.message || 'Failed to load')
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only load
  }, [])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function onSelectChange(id) {
    setSelectedId(id)
    const selected = profiles.find((p) => p.id === id) || null
    setForm(formFromProfile(selected))
    const activeName = profiles.find((p) => p.id === activeId)?.name || ''
    setStatus(`Editing ${selected?.name || '—'} · active ${activeName || '—'}`)
  }

  async function setActive() {
    if (!selectedId || busy) return
    setBusy(true)
    setError(null)
    try {
      const data = await putJson('/api/quality-profiles/active', { id: selectedId })
      applyStore(data, selectedId)
      setStatus('Active profile updated')
    } catch (err) {
      setError(err.message || 'Activate failed')
      setStatus(err.message || 'Activate failed')
    } finally {
      setBusy(false)
    }
  }

  async function createProfile() {
    if (busy) return
    const name = window.prompt('New profile name', 'Profile')
    if (name == null) return
    setBusy(true)
    setError(null)
    try {
      const created = await postJson('/api/quality-profiles', {
        name: String(name).trim() || 'Profile',
      })
      await reload(created.id || '')
      setStatus(`Created ${created.name || 'profile'}`)
    } catch (err) {
      setError(err.message || 'Create failed')
      setStatus(err.message || 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  async function deleteProfile() {
    if (!selectedId || profiles.length <= 1 || busy) return
    const selected = profiles.find((p) => p.id === selectedId)
    if (!window.confirm(`Delete profile “${selected?.name || selectedId}”?`)) return
    setBusy(true)
    setError(null)
    try {
      const data = await deleteJson(`/api/quality-profiles/${encodeURIComponent(selectedId)}`)
      applyStore(data, '')
      setStatus('Profile deleted')
    } catch (err) {
      setError(err.message || 'Delete failed')
      setStatus(err.message || 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  async function saveProfile(event) {
    event.preventDefault()
    if (!selectedId || busy) return
    setBusy(true)
    setError(null)
    try {
      const saved = await putJson(
        `/api/quality-profiles/${encodeURIComponent(selectedId)}`,
        bodyFromForm(form),
      )
      await reload(saved.id || selectedId)
      setStatus('Saved')
    } catch (err) {
      setError(err.message || 'Save failed')
      setStatus(err.message || 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function runScoreProbe() {
    const title = probeTitle.trim()
    if (!title || busy) return
    setBusy(true)
    setProbeResult(null)
    try {
      const result = await postJson('/api/quality-profiles/score', {
        title,
        profile_id: selectedId || undefined,
      })
      setProbeResult(result)
    } catch (err) {
      setProbeResult({ error: err.message || 'Score failed' })
    } finally {
      setBusy(false)
    }
  }

  if (error && profiles.length === 0) {
    return (
      <div className="gt-admin-page">
        <h1>Quality Profiles</h1>
        <PageStatus error={error} />
        <a className="gt-btn" href="/admin/settings">
          Back to settings
        </a>
      </div>
    )
  }

  return (
    <div className="gt-admin-page">
      <h1>Quality Profiles</h1>
      <p className="gt-admin-lede">
        Preferred / blocked release groups, naming patterns, excluded terms, and size bands. The
        active profile scores Arr search hits and extends scan name-clean filters.
      </p>

      <div className="gt-admin-panel" style={{ marginBottom: 'var(--gt-space-5)' }}>
        <div className="gt-admin-actions-row" style={{ alignItems: 'flex-end', marginTop: 0 }}>
          <label className="gt-admin-field" style={{ flex: '1 1 12rem', margin: 0 }}>
            Profiles
            <select
              className="gt-admin-input"
              aria-label="Quality profiles"
              value={selectedId}
              onChange={(e) => onSelectChange(e.target.value)}
              disabled={!profiles.length}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || 'Profile'}
                  {p.id === activeId ? ' (active)' : ''}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="gt-btn" onClick={setActive} disabled={!selectedId || busy}>
            Set active
          </button>
          <button type="button" className="gt-btn" onClick={createProfile} disabled={busy}>
            New
          </button>
          <button
            type="button"
            className="gt-btn"
            onClick={deleteProfile}
            disabled={busy || profiles.length <= 1 || !selectedId}
          >
            Delete
          </button>
        </div>
        <p className="gt-admin-lede" style={{ marginBottom: 0 }} aria-live="polite">
          {status}
        </p>
      </div>

      <form className="gt-admin-panel" onSubmit={saveProfile}>
        <label className="gt-admin-field">
          Profile name
          <input
            className="gt-admin-input"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Default"
          />
        </label>
        <label className="gt-admin-field">
          Preferred groups (comma-separated)
          <input
            className="gt-admin-input"
            value={form.preferred_groups}
            onChange={(e) => updateField('preferred_groups', e.target.value)}
            placeholder="GOG, Steam"
          />
        </label>
        <label className="gt-admin-field">
          Preferred naming patterns (comma-separated)
          <input
            className="gt-admin-input"
            value={form.preferred_patterns}
            onChange={(e) => updateField('preferred_patterns', e.target.value)}
            placeholder="repack, proper, -GOG"
          />
        </label>
        <label className="gt-admin-field">
          Blocked groups (comma-separated)
          <input
            className="gt-admin-input"
            value={form.blocked_groups}
            onChange={(e) => updateField('blocked_groups', e.target.value)}
            placeholder="scene-tag, unwanted-group"
          />
        </label>
        <label className="gt-admin-field">
          Excluded terms (comma-separated)
          <input
            className="gt-admin-input"
            value={form.excluded_terms}
            onChange={(e) => updateField('excluded_terms', e.target.value)}
            placeholder="CAM, TS, SAMPLE"
          />
        </label>
        <div className="gt-admin-actions-row" style={{ marginTop: 0 }}>
          <label className="gt-admin-field" style={{ flex: '1 1 10rem' }}>
            Min size (MB)
            <input
              className="gt-admin-input"
              type="number"
              min="0"
              step="1"
              value={form.min_size_mb}
              onChange={(e) => updateField('min_size_mb', e.target.value)}
              placeholder="optional"
            />
          </label>
          <label className="gt-admin-field" style={{ flex: '1 1 10rem' }}>
            Max size (MB)
            <input
              className="gt-admin-input"
              type="number"
              min="0"
              step="1"
              value={form.max_size_mb}
              onChange={(e) => updateField('max_size_mb', e.target.value)}
              placeholder="optional"
            />
          </label>
        </div>
        <label className="gt-admin-field">
          <input
            type="checkbox"
            checked={form.prefer_repack}
            onChange={(e) => updateField('prefer_repack', e.target.checked)}
          />{' '}
          Prefer repack / proper in titles
        </label>
        <div className="gt-admin-actions-row">
          <button type="submit" className="gt-btn" disabled={!selectedId || busy}>
            Save profile
          </button>
          <a className="gt-btn" href="/admin/settings">
            Back to settings
          </a>
        </div>
      </form>

      <div className="gt-admin-panel" style={{ marginTop: 'var(--gt-space-5)' }}>
        <h2 className="gt-admin-panel-title">Test title score</h2>
        <p className="gt-admin-lede">
          Probe <code>POST /api/quality-profiles/score</code> against the selected profile.
        </p>
        <div className="gt-admin-actions-row" style={{ alignItems: 'flex-end' }}>
          <label className="gt-admin-field" style={{ flex: '1 1 16rem', margin: 0 }}>
            Release title
            <input
              className="gt-admin-input"
              value={probeTitle}
              onChange={(e) => setProbeTitle(e.target.value)}
              placeholder="Game.Title-GOG-repack"
              aria-label="Test release title"
            />
          </label>
          <button type="button" className="gt-btn" onClick={runScoreProbe} disabled={!probeTitle.trim() || busy}>
            Score
          </button>
        </div>
        {probeResult ? (
          <p className="gt-admin-lede" style={{ marginBottom: 0 }} aria-live="polite">
            {probeResult.error
              ? probeResult.error
              : `Score ${probeResult.score} · ${probeResult.allowed ? 'allowed' : 'blocked'}${
                  (probeResult.reasons || []).length
                    ? ` · ${(probeResult.reasons || []).join(', ')}`
                    : ''
                }`}
          </p>
        ) : null}
      </div>
    </div>
  )
}
