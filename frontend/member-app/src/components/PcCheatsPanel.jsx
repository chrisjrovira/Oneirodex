import { useCallback, useEffect, useState } from 'react'
import './PcCheatsPanel.css'

/**
 * PC cheat notes (FEAT-D2).
 *
 * Mounts only when Backend reports `cheat_surface === 'pc_wand'`, so it can
 * never appear beside the RetroArch `.cht` panel — the two surfaces stay
 * separate by construction rather than by convention.
 *
 * These are *notes*: what to type, what to edit, which launch flag. GameTheca
 * does not modify game files or touch a running game, and the panel says so
 * rather than leaving the reader to assume a trainer.
 */
export function PcCheatsPanel({ gameUuid, cheatSurface, canEdit = false }) {
  const [cheats, setCheats] = useState([])
  const [methods, setMethods] = useState([])
  const [stance, setStance] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(null)
  const [draft, setDraft] = useState({ label: '', method: 'console', payload: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const allowed = cheatSurface === 'pc_wand'

  const load = useCallback(async () => {
    if (!allowed || !gameUuid) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/games/${gameUuid}/pc_cheats`, {
        credentials: 'same-origin',
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not load cheats')
      setCheats(Array.isArray(data.cheats) ? data.cheats : [])
      setMethods(Array.isArray(data.methods) ? data.methods : [])
      setStance(data.stance || '')
    } catch (err) {
      setError(err.message || 'Could not load cheats')
      setCheats([])
    } finally {
      setLoading(false)
    }
  }, [allowed, gameUuid])

  useEffect(() => {
    void load()
  }, [load])

  if (!allowed) {
    return null
  }

  const methodLabel = (id) => methods.find((m) => m.id === id)?.label || id

  function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content || ''
  }

  async function addCheat(event) {
    event.preventDefault()
    if (!draft.label.trim()) return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/games/${gameUuid}/pc_cheats`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
        body: JSON.stringify(draft),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not save')
      setDraft({ label: '', method: draft.method, payload: '', notes: '' })
      await load()
    } catch (err) {
      setError(err.message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function removeCheat(cheatId) {
    setError('')
    try {
      const response = await fetch(`/api/games/${gameUuid}/pc_cheats/${cheatId}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'X-CSRFToken': csrfToken() },
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Could not remove')
      }
      await load()
    } catch (err) {
      setError(err.message || 'Could not remove')
    }
  }

  async function copyPayload(cheat) {
    if (!cheat.payload) return
    try {
      await navigator.clipboard.writeText(cheat.payload)
      setCopied(cheat.id)
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      // Clipboard can be blocked; the text is on screen either way.
      setCopied(null)
    }
  }

  return (
    <section className="gt-pccheats" aria-labelledby="gt-pccheats-heading">
      <h2 id="gt-pccheats-heading">Cheats &amp; tweaks</h2>

      {stance ? <p className="gt-pccheats__stance">{stance}</p> : null}

      {loading ? <p className="gt-pccheats__muted">Loading…</p> : null}
      {error ? (
        <p className="gt-pccheats__error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && cheats.length === 0 ? (
        <p className="gt-pccheats__muted">
          No cheats recorded for this title yet.
          {canEdit ? ' Add one below.' : ''}
        </p>
      ) : null}

      {cheats.length > 0 ? (
        <ul className="gt-pccheats__list">
          {cheats.map((cheat) => (
            <li key={cheat.id} className="gt-pccheats__item">
              <div className="gt-pccheats__head">
                <strong className="gt-pccheats__label">{cheat.label}</strong>
                <span className="gt-pccheats__method">{methodLabel(cheat.method)}</span>
                {cheat.single_player_only ? (
                  <span
                    className="gt-pccheats__flag"
                    title="Recorded for single-player use"
                  >
                    single-player
                  </span>
                ) : null}
              </div>

              {cheat.payload ? (
                <div className="gt-pccheats__payload">
                  {/* Verbatim and monospaced — it gets typed or pasted exactly. */}
                  <code>{cheat.payload}</code>
                  <button
                    type="button"
                    className="gt-btn gt-btn--ghost gt-pccheats__copy"
                    onClick={() => void copyPayload(cheat)}
                  >
                    {copied === cheat.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
              ) : null}

              {cheat.notes ? <p className="gt-pccheats__notes">{cheat.notes}</p> : null}

              {canEdit ? (
                <button
                  type="button"
                  className="gt-btn gt-btn--ghost gt-pccheats__remove"
                  onClick={() => void removeCheat(cheat.id)}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {canEdit ? (
        <form className="gt-pccheats__form" onSubmit={addCheat}>
          <h3 className="gt-pccheats__form-title">Add a cheat note</h3>

          <label>
            What it does
            <input
              type="text"
              value={draft.label}
              maxLength={160}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="e.g. God mode"
            />
          </label>

          <label>
            How
            {/* Options come from the API so the picker cannot drift from the
                methods the backend accepts. */}
            <select
              value={draft.method}
              onChange={(e) => setDraft({ ...draft, method: e.target.value })}
            >
              {methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Exactly what to type or set
            <input
              type="text"
              value={draft.payload}
              onChange={(e) => setDraft({ ...draft, payload: e.target.value })}
              placeholder="sv_cheats 1; god"
            />
          </label>

          <label>
            Notes
            <input
              type="text"
              value={draft.notes}
              maxLength={1000}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Open the console with ~"
            />
          </label>

          <button
            type="submit"
            className="gt-btn gt-btn--primary"
            disabled={saving || !draft.label.trim()}
          >
            {saving ? 'Saving…' : 'Add cheat'}
          </button>
        </form>
      ) : null}
    </section>
  )
}
