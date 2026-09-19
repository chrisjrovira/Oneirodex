import { useState } from 'react'
import { Button } from '@oneirodex/ui'

/* SettingsModal moved out of TrailersPage (v11 cycle, H-D.2) — unchanged. */

export function SettingsModal({ settings, onCancel, onSave }: LooseProps) {
  const [draft, setDraft] = useState(settings)

  return (
    <div
      className="od-trailers__modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Auto-Play Settings"
    >
      <div className="od-trailers__modal">
        <h2>Auto-Play Settings</h2>

        <label className="od-trailers__toggle">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
          />
          Auto-play next video
        </label>

        <label htmlFor="od-trailers-skip-first">Skip first (seconds)</label>
        <input
          id="od-trailers-skip-first"
          type="number"
          min={0}
          max={300}
          value={draft.skipFirst}
          onChange={(event) => setDraft({ ...draft, skipFirst: event.target.value })}
        />

        <label htmlFor="od-trailers-skip-after">Skip to next after playing (seconds)</label>
        <input
          id="od-trailers-skip-after"
          type="number"
          min={0}
          max={600}
          value={draft.skipAfter}
          onChange={(event) => setDraft({ ...draft, skipAfter: event.target.value })}
        />
        <small>Load next video after watching for this long (0 to disable)</small>

        <div className="od-trailers__modal-actions">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button className="od-btn--accent" onClick={() => onSave(draft)}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
