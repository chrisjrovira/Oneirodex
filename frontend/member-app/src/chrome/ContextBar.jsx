import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Slots in the top bar that page controls render into.
 *
 * Three, not one. The bar answers three different questions and they belong at
 * three different places in it: what can I narrow this to (lead, beside the
 * rail toggle), which sibling view am I on (centre), and how much is here
 * (trail, beside the tile size control). A single slot put all three in a row
 * wherever the widest label happened to leave them.
 */
export const TOPBAR_SLOT_ID = 'gt-topbar-slot'
export const TOPBAR_LEAD_ID = 'gt-topbar-lead'
export const TOPBAR_TRAIL_ID = 'gt-topbar-trail'
/* Four, now. The lead slot sits *inside* the toggle/Filters cluster, so
   anything portalled there is a sibling of the hamburger — correct for
   Filters, wrong for a page title. The title gets its own slot immediately
   after the cluster instead. */
export const TOPBAR_TITLE_ID = 'gt-topbar-title'

/** Marks a host div as belonging to one ContextBar instance. */
const HOST_ATTR = 'data-gt-contextbar-host'

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

/**
 * @param {object} props
 * @param {boolean} [props.chromeless] Drop the panel's own head row. Use when
 *   the content already carries its own frame and dismiss control — otherwise
 *   the panel and the content read as two nested boxes with the trigger's own
 *   label repeated between them.
 * @param {React.ReactNode | ((api: { close: () => void }) => React.ReactNode)}
 *   props.children Given a function, it receives `close` so the content can own
 *   its own dismiss control.
 */
export function Popover({
  label,
  icon = null,
  count = 0,
  children,
  align = 'end',
  chromeless = false,
}) {
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
          className={`gt-pop__panel${chromeless ? ' gt-pop__panel--bare' : ''}`}
          role="dialog"
          aria-label={label}
        >
          {chromeless ? null : (
            <div className="gt-pop__head">
              <span className="gt-pop__title">{label}</span>
              <button type="button" className="gt-cbtn" onClick={close}>
                Done
              </button>
            </div>
          )}
          {typeof children === 'function' ? children({ close }) : children}
        </div>
      ) : null}
    </div>
  )
}

export function ContextBar({
  views,
  activeView,
  onSelectView,
  title = null,
  filters = null,
  filterCount = 0,
  summary = null,
  actions = null,
  overflow = null,
  t = (key) => key,
}) {
  const [slots, setSlots] = useState(null)
  const instanceId = useId()

  // Own the nodes we portal into, and evict anyone else's.
  //
  // Portalling straight into the shared slot divs left a page's controls in the
  // bar after that page was gone: the first ContextBar mounted after login
  // never had its portal torn down, so its view strip sat in the centre slot on
  // every subsequent page — Library showed Activity's "Everyone / Friends only"
  // above its own strip, which read as buttons that follow you around. React
  // only removes portal children if the *unmount* runs, and a route that
  // suspends and is discarded can skip it.
  //
  // So each instance appends its own host div, tagged with its id, and sweeps
  // out hosts belonging to any other instance as it arrives. Cleanup still
  // removes our own hosts on the way out; the sweep is what makes a missed
  // cleanup self-correcting rather than permanent — the next page to render
  // controls clears whatever was stranded.
  useLayoutEffect(() => {
    if (typeof document === 'undefined') return undefined

    const centre = document.getElementById(TOPBAR_SLOT_ID)
    if (!centre) return undefined

    const targets = {
      centre,
      lead: document.getElementById(TOPBAR_LEAD_ID),
      title: document.getElementById(TOPBAR_TITLE_ID),
      trail: document.getElementById(TOPBAR_TRAIL_ID),
    }

    const hosts = {}
    Object.entries(targets).forEach(([name, target]) => {
      if (!target) return
      target.querySelectorAll(`[${HOST_ATTR}]`).forEach((node) => {
        if (node.getAttribute(HOST_ATTR) !== instanceId) node.remove()
      })
      const host = document.createElement('div')
      host.setAttribute(HOST_ATTR, instanceId)
      host.className = 'gt-contextbar__host'
      target.appendChild(host)
      hosts[name] = host
    })

    setSlots(hosts)
    return () => {
      Object.values(hosts).forEach((host) => host.remove())
      setSlots(null)
    }
  }, [instanceId])

  // A page that takes `close` owns its own dismiss, so the popover drops its
  // head row: the panel already carries a frame, and the trigger beside it
  // already says "Filters" — with the head the popover drew a second box around
  // a box and repeated the word between them. Pages still passing a plain node
  // (Calendar, Trailers) keep the head, because it holds their only Done.
  const ownsDismiss = typeof filters === 'function'
  const filterControl = filters ? (
    /* Left-anchored: this trigger sits at the *left* end of the bar now, and a
       right-anchored panel there opens over the rail — or off the window edge
       once the rail is collapsed. */
    <Popover
      label={t('Filters')}
      count={filterCount}
      chromeless={ownsDismiss}
      align="start"
    >
      {filters}
    </Popover>
  ) : null

  const viewControl = (
    <>
      <SegmentedViews
        views={views}
        active={activeView}
        onSelect={onSelectView}
        label={t('Views')}
      />
      {actions}
      {overflow ? <Popover label={t('More')}>{overflow}</Popover> : null}
    </>
  )

  const countControl = summary ? (
    <span className="gt-contextbar__count">{summary}</span>
  ) : null

  /* A name for a page the nav tables cannot name.
   *
   * `getPageTitle` derives bar one's section label from the rail's own link
   * tables, which is right for every routed destination and useless for the
   * ones whose name is data: a Discover row's "see all" page is called
   * whatever that row is called, and the table can only ever say "Discover".
   * DiscoverRowPage had been passing `title` since it was written and this
   * component simply did not accept the prop, so the name was dropped on the
   * floor — the page opened with no indication of which row you had opened.
   *
   * Rendered into the lead slot as the same `.gt-topbar__section` element the
   * bar uses for its own titles, so a data-named page reads identically to a
   * table-named one. gt-shell.css suppresses the bar's copy when this is
   * present, otherwise a collapsed rail showed both. */
  const titleControl = title ? (
    <span className="gt-topbar__section">{title}</span>
  ) : null

  // One bar, not two.
  //
  // This rendered as its own row under the top bar, which read as "a toolbar on
  // the page" rather than as chrome — the thing the two-bar layout was supposed
  // to stop. A page's controls belong beside the page's name, so the content
  // portals into the top bar instead.
  //
  // Portalled rather than lifted into TopBar via props: every page already
  // feeds this component, so moving the render target moves all of them at
  // once, and each page keeps owning its own handlers. Same pattern the library
  // filters already use with #gt-rail-slot.
  //
  // Three targets rather than one — see the slot ids above. Filters sits with
  // the rail toggle because narrowing is the first thing you do to a list; the
  // views sit centred because they are the page itself; the count sits with the
  // tile size control because both describe how much you are looking at.
  //
  // Falls back to one inline bar when there is no top bar — Big Picture, the
  // pop-out chat host, and tests — rather than vanishing.
  if (!slots) {
    return (
      <div className="gt-contextbar">
        {titleControl}
        {viewControl}
        <div className="gt-contextbar__actions">
          {countControl}
          {filterControl}
        </div>
      </div>
    )
  }

  // No extra wrapper around `viewControl`: SegmentedViews already renders
  // `.gt-contextbar__views`, so wrapping it produced that class nested inside
  // itself and two boxes' worth of layout for one strip.
  return (
    <>
      {createPortal(filterControl, slots.lead || slots.centre)}
      {createPortal(titleControl, slots.title || slots.lead || slots.centre)}
      {createPortal(viewControl, slots.centre)}
      {createPortal(countControl, slots.trail || slots.centre)}
    </>
  )
}
