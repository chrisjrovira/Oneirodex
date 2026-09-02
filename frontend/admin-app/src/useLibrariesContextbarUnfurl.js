import { useLayoutEffect } from 'react'
import { ADMIN_TOPBAR_SLOT_ID } from './useLegacyContextbarPortal'

/**
 * Collapse Libraries / Auto scan / Manual scan into two unfurl segs.
 *
 * Member ContextBar already owns this pattern for View. Admin Jinja still emits
 * a flat Bootstrap-tab segment list; after the contextbar portals into the thin
 * top bar, rewrite the seg so Libraries and Scan unfurl menus match the member
 * chrome without replacing the whole multi-pane document.
 */
export function useLibrariesContextbarUnfurl(enabled) {
  useLayoutEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined

    const pageSlot = document.getElementById(ADMIN_TOPBAR_SLOT_ID)
    const views = pageSlot?.querySelector(':scope > .od-contextbar__views')
    const seg = views?.querySelector(':scope > .od-seg')
    if (!seg || seg.dataset.odUnfurlReady === '1') return undefined

    const items = Array.from(seg.querySelectorAll(':scope > a.od-seg__item'))
    if (!items.length) return undefined

    const byHref = (needles) =>
      items.find((el) => needles.some((n) => (el.getAttribute('href') || '').includes(n)))

    const librariesItem = byHref(['#librariesPanel', '/libraries'])
    const autoItem = byHref(['#autoScan', 'active_tab=auto'])
    const manualItem = byHref(['#manualScan', 'active_tab=manual'])
    if (!librariesItem && !autoItem && !manualItem) return undefined

    const panel = document.getElementById('odLibrariesPanel')
    const addHref = panel?.getAttribute('data-add-url') || '/admin/library/add'

    /** @type {{ closeAll: () => void, syncActive: () => void }} */
    const api = {
      closeAll() {},
      syncActive() {},
    }
    /** @type {HTMLElement[]} */
    const unfurls = []

    const makeUnfurl = (triggerLabel, menuItems, { activeWhen } = {}) => {
      const anchor = document.createElement('span')
      anchor.className = 'od-seg__unfurl-anchor'

      const trigger = document.createElement('button')
      trigger.type = 'button'
      trigger.className = 'od-seg__item'
      trigger.setAttribute('aria-haspopup', 'true')
      trigger.setAttribute('aria-expanded', 'false')
      trigger.textContent = triggerLabel

      const panelEl = document.createElement('div')
      panelEl.className = 'od-contextbar__views-unfurl'
      panelEl.setAttribute('role', 'group')
      panelEl.setAttribute('aria-label', triggerLabel)
      panelEl.hidden = true

      menuItems.forEach((entry) => {
        const link = document.createElement('a')
        link.className = 'od-seg__item'
        link.href = entry.href
        link.textContent = entry.label
        if (entry.tab) {
          link.setAttribute('data-bs-toggle', 'tab')
          link.setAttribute('role', 'tab')
        }
        link.addEventListener('click', () => {
          api.closeAll()
          if (entry.tab) {
            window.requestAnimationFrame(() => api.syncActive())
          }
        })
        panelEl.appendChild(link)
      })

      const setOpen = (open) => {
        panelEl.hidden = !open
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false')
        views.classList.toggle('is-unfurled', open)
        seg.classList.toggle('is-unfurled', open)
        if (open) trigger.classList.add('is-active')
        else api.syncActive()
      }

      trigger.addEventListener('click', (event) => {
        event.preventDefault()
        const willOpen = panelEl.hidden
        api.closeAll()
        if (willOpen) setOpen(true)
      })

      anchor.appendChild(trigger)
      anchor.appendChild(panelEl)
      anchor._odSetOpen = setOpen
      anchor._odActiveWhen = activeWhen
      return anchor
    }

    if (librariesItem) {
      // Trigger already says "Libraries" — only offer the extra action.
      unfurls.push(
        makeUnfurl(
          'Libraries',
          [{ label: 'Add library', href: addHref, tab: false }],
          {
            activeWhen: () =>
              Boolean(
                document.querySelector('#librariesPanel.active, #librariesPanel.show') ||
                  librariesItem.classList.contains('active'),
              ),
          },
        ),
      )
    }
    if (autoItem || manualItem) {
      const autoHref = autoItem?.getAttribute('href') || '#autoScan'
      const manualHref = manualItem?.getAttribute('href') || '#manualScan'
      unfurls.push(
        makeUnfurl(
          'Scan',
          [
            { label: 'Auto scan', href: autoHref, tab: autoHref.startsWith('#') },
            { label: 'Manual scan', href: manualHref, tab: manualHref.startsWith('#') },
          ],
          {
            activeWhen: () =>
              Boolean(
                document.querySelector(
                  '#autoScan.active, #autoScan.show, #manualScan.active, #manualScan.show',
                ) ||
                  autoItem?.classList.contains('active') ||
                  manualItem?.classList.contains('active'),
              ),
          },
        ),
      )
    }

    api.closeAll = () => {
      unfurls.forEach((node) => node._odSetOpen?.(false))
      views.classList.remove('is-unfurled')
      seg.classList.remove('is-unfurled')
    }

    api.syncActive = () => {
      unfurls.forEach((node) => {
        const trigger = node.querySelector(':scope > .od-seg__item')
        if (!trigger) return
        const on = Boolean(node._odActiveWhen?.())
        // While a menu is open the trigger stays visually active.
        if (trigger.getAttribute('aria-expanded') === 'true') return
        trigger.classList.toggle('active', on)
        trigger.classList.toggle('is-active', on)
        if (on) trigger.setAttribute('aria-current', 'page')
        else trigger.removeAttribute('aria-current')
      })
    }

    const firstKeep = items.find(
      (el) => el !== librariesItem && el !== autoItem && el !== manualItem,
    )
    unfurls.forEach((node) => {
      if (firstKeep) seg.insertBefore(node, firstKeep)
      else seg.appendChild(node)
    })
    // Remember where each original sat. This effect rewrites DOM that React
    // does not own, so cleanup has to be able to put the Jinja-rendered segment
    // back exactly as it was.
    const displaced = [librariesItem, autoItem, manualItem]
      .filter(Boolean)
      .map((el) => ({ el, parent: el.parentNode, next: el.nextSibling }))
    displaced.forEach(({ el }) => el.remove())

    seg.dataset.odUnfurlReady = '1'
    api.syncActive()

    const onDocClick = (event) => {
      if (!views.contains(event.target)) api.closeAll()
    }
    const onKey = (event) => {
      if (event.key === 'Escape') api.closeAll()
    }
    const onTabShown = () => {
      api.closeAll()
      api.syncActive()
    }

    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKey)
    document.addEventListener('shown.bs.tab', onTabShown)

    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('shown.bs.tab', onTabShown)

      // Undo the rewrite as well. Without this the injected triggers outlive
      // the effect that owned them, and because `odUnfurlReady` stays set the
      // next mount returns early — leaving menus that no longer close on
      // Escape or click-outside, and an active state that never re-syncs.
      unfurls.forEach((node) => node.remove())
      // Reverse order so each restored node's original `nextSibling` is back in
      // the DOM before the node that precedes it needs to anchor against it.
      ;[...displaced].reverse().forEach(({ el, parent, next }) => {
        if (!parent || !parent.isConnected) return
        parent.insertBefore(el, next && next.parentNode === parent ? next : null)
      })
      views.classList.remove('is-unfurled')
      seg.classList.remove('is-unfurled')
      delete seg.dataset.odUnfurlReady
    }
  }, [enabled])
}
