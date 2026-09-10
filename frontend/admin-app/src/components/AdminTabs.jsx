import { useEffect, useMemo, useState } from 'react'
import './AdminTabs.css'

/**
 * Tab bar for a legacy Jinja form.
 *
 * The panels are server-rendered — this owns only which one is visible, so a
 * page keeps its existing field names and POSTs to the same handler. Hiding a
 * panel with `hidden` leaves its inputs in the form, so every field still
 * submits from whichever tab it lives on.
 *
 * Panels declare themselves with `data-od-tab-panel="<id>"` and
 * `data-od-tab-label="<label>"`, so adding a tab is a template change.
 */
export function AdminTabs({ container }) {
  const panels = useMemo(() => {
    if (!container) return []
    return Array.from(container.querySelectorAll('[data-od-tab-panel]')).map((el) => ({
      id: el.dataset.odTabPanel,
      label: el.dataset.odTabLabel || el.dataset.odTabPanel,
      el,
      // A field that failed validation must not be hidden behind a tab the
      // member has no reason to open — the form would just refuse to save
      // with nothing on screen saying why.
      hasError: Boolean(el.querySelector('.alert-danger')),
    }))
  }, [container])

  const firstErrored = panels.find((panel) => panel.hasError)
  const [active, setActive] = useState(() => firstErrored?.id || panels[0]?.id || '')

  useEffect(() => {
    if (!panels.length) return
    for (const panel of panels) {
      panel.el.hidden = panel.id !== active
    }
  }, [panels, active])

  if (panels.length < 2) return null

  function onKeyDown(event) {
    const index = panels.findIndex((panel) => panel.id === active)
    if (index < 0) return
    let next = null
    if (event.key === 'ArrowRight') next = (index + 1) % panels.length
    if (event.key === 'ArrowLeft') next = (index - 1 + panels.length) % panels.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = panels.length - 1
    if (next === null) return
    event.preventDefault()
    setActive(panels[next].id)
  }

  return (
    <div className="od-admin-tabs" role="tablist" onKeyDown={onKeyDown}>
      {panels.map((panel) => {
        const selected = panel.id === active
        return (
          <button
            key={panel.id}
            type="button"
            role="tab"
            id={`od-admin-tab-${panel.id}`}
            aria-selected={selected}
            aria-controls={panel.el.id || undefined}
            tabIndex={selected ? 0 : -1}
            className={`od-admin-tabs__tab${selected ? ' is-active' : ''}${
              panel.hasError ? ' has-error' : ''
            }`}
            onClick={() => setActive(panel.id)}
          >
            {panel.label}
            {panel.hasError ? (
              <span className="od-admin-tabs__dot" aria-label="has errors" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
