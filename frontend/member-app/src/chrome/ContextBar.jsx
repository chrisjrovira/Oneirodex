import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** Slot in the top bar that page controls render into. */
export const TOPBAR_SLOT_ID = 'gt-topbar-slot'

/**
 * Bar two — everything the current page can do (UIR-1, Option B).
 *
 * Left: a segmented control over sibling views. This is where the page title
 * used to be. Making the name a *switcher* rather than a label is the whole
 * point — a heading that says "Library" when you are already looking at the
 * library is the least useful pixel on the page.
 *
 * Right: one Filters popover and one overflow. Two competing overflow menus is
 * what we are getting away from, so this component deliberately offers exactly
 * one of each.
 *
 * No CSS import: the styles live in the shared `gt-appbar.css` theme asset so
 * Jinja admin renders the identical bar (UIR-4) without duplicating anything.
 */

function useDismiss(open, onClose, refs) {
  useEffect(() => {
    if (!open) return undefined

    function onKey(event) {
      if (event.key === 'Escape') onClose()
    }
    function onPointer(event) {
      // Clicking the trigger toggles; the trigger handles that itself.
      const inside = refs.some((ref) => ref.current?.contains(event.target))
      if (!inside) onClose()
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [open, onClose, refs])
}

export function SegmentedViews({ views, active, onSelect, label = 'Views' }) {
  if (!Array.isArray(views) || views.length === 0) return null

  return (
    <div className="gt-contextbar__views">
      <div className="gt-seg" role="group" aria-label={label}>
        {views.map((view) => {
          const selected = view.id === active
          return (
            <button
              key={view.id}
              type="button"
              className={`gt-seg__item${selected ? ' is-active' : ''}`}
              aria-pressed={selected}
              onClick={() => onSelect?.(view.id)}
            >
              {view.label}
              {typeof view.count === 'number' ? (
                <span className="gt-seg__count"> {view.count}</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Popover({ label, icon = null, count = 0, children, align = 'end' }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const panelId = useId()
  const close = useCallback(() => setOpen(false), [])

  useDismiss(open, close, [triggerRef, panelRef])

  const active = count > 0

  return (
    <div className="gt-pop" data-align={align}>
      <button
        type="button"
        ref={triggerRef}
        className={`gt-cbtn${active ? ' is-on' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {icon}
        {label}
        {active ? <span className="gt-cbtn__count">{count}</span> : null}
      </button>

      {open ? (
        <div
          id={panelId}
          ref={panelRef}
          className="gt-pop__panel"
          role="dialog"
          aria-label={label}
        >
          <div className="gt-pop__head">
            <span className="gt-pop__title">{label}</span>
            <button type="button" className="gt-cbtn" onClick={close}>
              Done
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </div>
  )
}

export function ContextBar({
  views,
  activeView,
  onSelectView,
  filters = null,
  filterCount = 0,
  summary = null,
  actions = null,
  overflow = null,
  t = (key) => key,
}) {
  const [slot, setSlot] = useState(null)

  // Find the top bar's slot after mount, not during render: TopBar and the
  // routed page mount in the same commit, so the node does not exist while this
  // component is first rendering.
  useEffect(() => {
    setSlot(document.getElementById(TOPBAR_SLOT_ID))
  }, [])

  const content = (
    <div className="gt-contextbar">
      <SegmentedViews
        views={views}
        active={activeView}
        onSelect={onSelectView}
        label={t('Views')}
      />

      <div className="gt-contextbar__actions">
        {summary ? <span className="gt-contextbar__count">{summary}</span> : null}

        {filters ? (
          <Popover label={t('Filters')} count={filterCount}>
            {filters}
          </Popover>
        ) : null}

        {actions}

        {overflow ? (
          <Popover label={t('More')}>{overflow}</Popover>
        ) : null}
      </div>
    </div>
  )

  // One bar, not two.
  //
  // This rendered as its own row under the top bar, which read as "a toolbar on
  // the page" rather than as chrome — the thing the two-bar layout was supposed
  // to stop. A page's controls belong beside the page's name, so the content
  // portals into a slot in the top bar instead.
  //
  // Portalled rather than lifted into TopBar via props: every page already
  // feeds this component, so moving the render target moves all of them at
  // once, and each page keeps owning its own handlers. Same pattern the library
  // filters already use with #gt-rail-slot.
  //
  // Falls back to rendering in place when there is no top bar — Big Picture,
  // the pop-out chat host, and tests — rather than vanishing.
  return slot ? createPortal(content, slot) : content
}
