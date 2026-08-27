import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchOpsSummary } from './api/summary'
import { PageStatus } from './PageStatus'
import { DeepLinks } from './components/DeepLinks'
import { HostPanel } from './components/HostPanel'
import { IssuesList } from './components/IssuesList'
import { LibraryPulse } from './components/LibraryPulse'
import { NetworkPanel } from './components/NetworkPanel'
import { RecentErrors } from './components/RecentErrors'
import { ScansPanel } from './components/ScansPanel'
import { StatusBanner } from './components/StatusBanner'

function isAbortError(error) {
  return error?.name === 'AbortError'
}

export function OpsApp({ pollMs = 15000 }) {
  const [snapshot, setSnapshot] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const requestRef = useRef({ id: 0, controller: null })

  const refresh = useCallback(() => {
    requestRef.current.controller?.abort()
    const controller = new AbortController()
    const id = requestRef.current.id + 1
    requestRef.current = { id, controller }
    setLoading(true)
    setError(null)

    fetchOpsSummary({ signal: controller.signal })
      .then((nextSnapshot) => {
        if (requestRef.current.id === id && !controller.signal.aborted) {
          setSnapshot(nextSnapshot)
          setError(null)
          setLoading(false)
        }
      })
      .catch((requestError) => {
        if (
          requestRef.current.id === id &&
          !controller.signal.aborted &&
          !isAbortError(requestError)
        ) {
          setError(requestError)
          setLoading(false)
        }
      })
  }, [])

  useEffect(() => {
    refresh()
    const intervalId = window.setInterval(refresh, pollMs)

    return () => {
      window.clearInterval(intervalId)
      requestRef.current.controller?.abort()
    }
  }, [pollMs, refresh])

  return (
    <main className="ops-glance">
      <header className="ops-glance__header">
        <div className="ops-glance__title">Operations glance</div>
        <button type="button" onClick={refresh} disabled={loading}>
          Refresh
        </button>
      </header>

      {error && snapshot ? (
        <PageStatus error={error} onRetry={refresh} retryLabel="Retry" />
      ) : null}

      {!snapshot ? (
        <PageStatus
          loading={loading}
          error={error}
          onRetry={refresh}
          retryLabel="Retry"
          loadingMessage="Loading operations summary…"
        />
      ) : (
        <>
          <StatusBanner issues={snapshot.issues} asOf={snapshot.as_of} />
          <div className="ops-glance__grid">
            <HostPanel host={snapshot.host} />
            <NetworkPanel network={snapshot.network} />
            <IssuesList issues={snapshot.issues} />
            <ScansPanel scans={snapshot.scans} />
            <LibraryPulse library={snapshot.library} />
            <RecentErrors errors={snapshot.recent_errors} />
          </div>
        </>
      )}

      <DeepLinks />
    </main>
  )
}
