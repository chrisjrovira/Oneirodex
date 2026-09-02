import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AdminPageActions } from './AdminPageActions'
import {
  DASH_RESIZE_PX_PER_COL,
  DASH_RESIZE_PX_PER_ROW,
  boardCellMetrics,
  commitMove,
  commitResize,
  defaultDashboardLayout,
  loadBoardLayout,
  loadDashboardLayout,
  mergeBoardLayout,
  rowsForContentHeight,
  saveBoardLayout,
  saveDashboardLayout,
  widgetMins,
} from './dashboardLayout'

function isInteractiveTarget(target) {
  if (!(target instanceof Element)) return true
  return Boolean(
    target.closest(
      'a, button, input, select, textarea, label, [role="button"], [contenteditable="true"]',
    ),
  )
}

/**
 * Draggable / resizable board shell (12-col grid) — Dashboard + Ops.
 *
 * Move uses a transform preview so the widget follows the pointer without
 * reflowing the CSS grid under the cursor. Grid coords commit on release.
 * No grab bar — drag from empty chrome; interactive controls stay clickable.
 * Resize is corner-only.
 *
 * Optional `storageKey` + `defaultLayout` switch the board onto a custom
 * persistence profile (Ops). Without them it keeps the Dashboard layout keys.
 *
 * Reset sits in the centre page slot (Users / member Library pattern).
 * Refresh sits in the trail; Updated appears as a hover popup on that control.
 */
export function DashboardBoard({
  widgets,
  hasErrors = false,
  asOf = null,
  onRefresh = null,
  refreshing = false,
  refreshDisabled = false,
  storageKey = null,
  defaultLayout = null,
  minsFn = widgetMins,
  layoutLabel = 'Dashboard layout',
  statusLabel = 'Dashboard status',
  refreshAriaLabel = 'Refresh dashboard',
  boardAriaLabel = null,
}) {
  const asOfId = useId()
  const isCustom = Boolean(storageKey && typeof defaultLayout === 'function')

  const [layout, setLayout] = useState(() => {
    if (isCustom) {
      return loadBoardLayout({ storageKey, defaultLayout, minsFn })
    }
    return loadDashboardLayout(hasErrors)
  })
  const [activeId, setActiveId] = useState(null)
  const [preview, setPreview] = useState(null)
  const boardRef = useRef(null)
  const dragRef = useRef(null)

  const visibleKey = useMemo(
    () =>
      Object.keys(widgets)
        .filter((id) => widgets[id])
        .sort()
        .join('|'),
    [widgets],
  )

  useEffect(() => {
    if (!isCustom) return
    setLayout((prev) => mergeBoardLayout(prev, defaultLayout(), minsFn))
  }, [isCustom, visibleKey, defaultLayout, minsFn])

  useEffect(() => {
    if (isCustom) return
    setLayout((prev) => {
      const ids = new Set(prev.map((item) => item.id))
      if (hasErrors && !ids.has('errors')) {
        return loadDashboardLayout(true)
      }
      if (!hasErrors && ids.has('errors')) {
        return prev.filter((item) => item.id !== 'errors')
      }
      return prev
    })
  }, [hasErrors, isCustom])

  useEffect(() => {
    if (isCustom) {
      saveBoardLayout(storageKey, layout, minsFn)
      return
    }
    saveDashboardLayout(layout)
  }, [layout, isCustom, storageKey, minsFn])

  // Health banner grows with issue folds; default h:2 clips Degraded content.
  useEffect(() => {
    const board = boardRef.current
    if (!board) return undefined
    const host = board.querySelector('[data-widget="status"] .od-dash__body')
    if (!host) return undefined

    const syncStatusHeight = () => {
      const metrics = boardCellMetrics(board)
      const minH = minsFn('status').h
      const need = rowsForContentHeight(host.scrollHeight, metrics.rowPitch, minH)
      setLayout((prev) => {
        const current = prev.find((item) => item.id === 'status')
        if (!current || current.h >= need) return prev
        return commitResize(prev, 'status', current.w, need, minsFn)
      })
    }

    syncStatusHeight()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(syncStatusHeight)
    observer.observe(host)
    return () => observer.disconnect()
  }, [widgets, layout.length, minsFn])

  const byId = useMemo(() => {
    const map = new Map()
    layout.forEach((item) => map.set(item.id, item))
    return map
  }, [layout])

  const endDrag = useCallback(() => {
    const drag = dragRef.current
    dragRef.current = null
    setActiveId(null)
    setPreview(null)
    if (!drag) return

    if (drag.mode === 'move') {
      const board = boardRef.current
      if (!board) return
      const rect = board.getBoundingClientRect()
      const { colPitch, rowPitch } = boardCellMetrics(board)
      const left = drag.lastX - drag.grabX
      const top = drag.lastY - drag.grabY
      const x = Math.round((left - rect.left) / colPitch)
      const y = Math.round((top - rect.top) / rowPitch)
      setLayout((prev) => commitMove(prev, drag.id, x, y, minsFn))
      return
    }

    const dx = drag.lastX - drag.originX
    const dy = drag.lastY - drag.originY
    const w = drag.start.w + Math.round(dx / (drag.colPitch * DASH_RESIZE_PX_PER_COL))
    const h = drag.start.h + Math.round(dy / (drag.rowPitch * DASH_RESIZE_PX_PER_ROW))
    setLayout((prev) => commitResize(prev, drag.id, w, h, minsFn))
  }, [minsFn])

  useEffect(() => {
    function onMove(event) {
      const drag = dragRef.current
      if (!drag) return
      drag.lastX = event.clientX
      drag.lastY = event.clientY
      if (drag.mode === 'move') {
        setPreview({
          id: drag.id,
          dx: event.clientX - drag.originX,
          dy: event.clientY - drag.originY,
          mode: 'move',
        })
        return
      }
      const w =
        drag.start.w +
        Math.round((event.clientX - drag.originX) / (drag.colPitch * DASH_RESIZE_PX_PER_COL))
      const h =
        drag.start.h +
        Math.round((event.clientY - drag.originY) / (drag.rowPitch * DASH_RESIZE_PX_PER_ROW))
      setPreview({ id: drag.id, w, h, mode: 'resize', start: drag.start })
    }

    function onUp() {
      if (!dragRef.current) return
      endDrag()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [endDrag])

  const beginMove = useCallback(
    (id, event) => {
      if (event.button !== 0) return
      if (isInteractiveTarget(event.target)) return
      const board = boardRef.current
      const item = byId.get(id)
      const host = event.currentTarget
      if (!board || !item || !(host instanceof Element)) return
      const hostRect = host.getBoundingClientRect()
      const { colPitch, rowPitch } = boardCellMetrics(board)
      dragRef.current = {
        mode: 'move',
        id,
        originX: event.clientX,
        originY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        grabX: event.clientX - hostRect.left,
        grabY: event.clientY - hostRect.top,
        start: { ...item },
        colPitch,
        rowPitch,
      }
      setActiveId(id)
      setPreview({ id, dx: 0, dy: 0, mode: 'move' })
      event.preventDefault()
    },
    [byId],
  )

  const beginResize = useCallback(
    (id, event) => {
      if (event.button !== 0) return
      const board = boardRef.current
      const item = byId.get(id)
      if (!board || !item) return
      const { colPitch, rowPitch } = boardCellMetrics(board)
      dragRef.current = {
        mode: 'resize',
        id,
        originX: event.clientX,
        originY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        start: { ...item },
        colPitch,
        rowPitch,
      }
      setActiveId(id)
      setPreview({ id, w: item.w, h: item.h, mode: 'resize', start: item })
      event.preventDefault()
      event.stopPropagation()
    },
    [byId],
  )

  function resetLayout() {
    if (isCustom) {
      try {
        window.localStorage?.removeItem(storageKey)
      } catch {
        /* private mode */
      }
      setLayout(defaultLayout())
      return
    }
    setLayout(defaultDashboardLayout({ hasErrors }))
  }

  const rowCount = Math.max(
    1,
    layout.reduce((max, item) => Math.max(max, item.y + item.h), 0),
  )

  return (
    <div className="od-dash">
      <AdminPageActions label={layoutLabel} slot="page">
        <button type="button" className="od-cbtn" onClick={resetLayout}>
          Reset layout
        </button>
      </AdminPageActions>
      {onRefresh ? (
        <AdminPageActions label={statusLabel} slot="trail">
          <span className="od-ops-refresh-wrap">
            <button
              type="button"
              className="od-ops-refresh-icon"
              aria-label={refreshing ? 'Refreshing' : refreshAriaLabel}
              aria-describedby={asOf ? asOfId : undefined}
              title={asOf ? `Updated ${new Date(asOf).toLocaleString()}` : 'Refresh'}
              onClick={onRefresh}
              disabled={refreshDisabled || refreshing}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"
                />
              </svg>
            </button>
            {asOf ? (
              <span id={asOfId} className="od-ops-refresh-asof" role="tooltip">
                Updated {new Date(asOf).toLocaleString()}
              </span>
            ) : null}
          </span>
        </AdminPageActions>
      ) : null}

      <div
        ref={boardRef}
        className="od-dash__board"
        aria-label={boardAriaLabel || undefined}
        style={{
          gridTemplateRows: `repeat(${rowCount}, var(--od-dash-row))`,
        }}
      >
        {layout.map((item) => {
          const body = widgets[item.id]
          if (!body) return null
          const busy = activeId === item.id
          const movePreview =
            busy && preview?.mode === 'move' && preview.id === item.id ? preview : null
          const resizePreview =
            busy && preview?.mode === 'resize' && preview.id === item.id ? preview : null
          return (
            <div
              key={item.id}
              className={`od-dash__item${busy ? ' is-dragging' : ''}`}
              style={{
                gridColumn: `${item.x + 1} / span ${item.w}`,
                gridRow: `${item.y + 1} / span ${item.h}`,
                ...(movePreview
                  ? {
                      transform: `translate(${movePreview.dx}px, ${movePreview.dy}px)`,
                      zIndex: 5,
                    }
                  : null),
              }}
              data-widget={item.id}
              onPointerDown={(event) => beginMove(item.id, event)}
            >
              <div className="od-dash__body">{body}</div>
              {resizePreview ? (
                <div
                  className="od-dash__resize-ghost"
                  aria-hidden="true"
                  style={{
                    width: `calc(100% * ${Math.max(1, resizePreview.w)} / ${item.w})`,
                    height: `calc(100% * ${Math.max(1, resizePreview.h)} / ${item.h})`,
                  }}
                />
              ) : null}
              <button
                type="button"
                className="od-dash__resize"
                aria-label={`Resize ${item.id}`}
                title="Drag corner to resize"
                onPointerDown={(event) => beginResize(item.id, event)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
