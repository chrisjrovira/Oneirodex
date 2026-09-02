import { createRoot } from 'react-dom/client'
import { useLayoutEffect } from 'react'
import { LibrariesPanel } from './LibrariesPanel'

const MOUNT_ID = 'odLibrariesReactRoot'

/**
 * Mount the React Libraries DataTable into the Jinja Libraries pane.
 */
export function useLibrariesPanelMount(enabled) {
  useLayoutEffect(() => {
    if (!enabled || typeof document === 'undefined') return undefined

    const host = document.getElementById(MOUNT_ID)
    if (!host || host.dataset.odMounted === '1') return undefined

    const panel = host.closest('#odLibrariesPanel') || document.getElementById('odLibrariesPanel')
    const root = createRoot(host)
    host.dataset.odMounted = '1'
    root.render(<LibrariesPanel panelEl={panel} />)

    return () => {
      root.unmount()
      delete host.dataset.odMounted
    }
  }, [enabled])
}
