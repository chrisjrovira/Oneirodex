import { useEffect, useRef } from 'react'

/**
 * Poll while the tab is visible. Skip overlapping in-flight work and abort
 * on unmount / next tick so a background tab cannot pile requests.
 */
export function useVisibilityPoll(callback, intervalMs) {
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    let cancelled = false
    let inFlight = false
    let controller = null

    const tick = () => {
      if (cancelled || document.hidden || inFlight) return
      inFlight = true
      controller?.abort()
      controller = new AbortController()
      const { signal } = controller
      Promise.resolve(cbRef.current({ signal }))
        .catch(() => {})
        .finally(() => {
          inFlight = false
        })
    }

    tick()
    const timer = window.setInterval(tick, intervalMs)
    const onVis = () => {
      if (!document.hidden) tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
      controller?.abort()
    }
  }, [intervalMs])
}
