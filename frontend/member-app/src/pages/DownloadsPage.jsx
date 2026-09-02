import { useEffect, useRef, useState } from 'react'
import { checkStatus, deleteDownload, fetchMyDownloads } from '../api/downloads'
import { PageStatus } from '../components/PageStatus'

const TERMINAL_STATUSES = new Set(['available', 'completed', 'failed', 'error', 'invalid', 'not_found'])
const POLL_INTERVAL_MS = 5000

function isTerminal(status) {
  return TERMINAL_STATUSES.has(String(status || '').toLowerCase())
}

export function DownloadsPage({ shellConfig: _shellConfig } = {}) {
  const [downloads, setDownloads] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const [deletingId, setDeletingId] = useState(null)
  const downloadsRef = useRef([])

  useEffect(() => {
    downloadsRef.current = downloads || []
  }, [downloads])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    setError(null)
    setDownloads(null)

    fetchMyDownloads({ signal: controller.signal })
      .then((result) => {
        if (active) {
          setDownloads(Array.isArray(result) ? result : [])
        }
      })
      .catch((requestError) => {
        if (active && requestError.name !== 'AbortError') {
          setError(requestError)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [retryCount])

  useEffect(() => {
    if (!downloads || downloads.length === 0) {
      return undefined
    }

    const needsPolling = downloads.some((item) => !isTerminal(item.status))
    if (!needsPolling) {
      return undefined
    }

    let cancelled = false

    const poll = async () => {
      const openRows = downloadsRef.current.filter((item) => !isTerminal(item.status))
      if (openRows.length === 0) {
        return
      }

      const updates = await Promise.all(
        openRows.map(async (row) => {
          try {
            const data = await checkStatus(row.id)
            if (!data?.found) {
              return null
            }
            return { id: row.id, status: data.status }
          } catch {
            return null
          }
        }),
      )

      if (cancelled) {
        return
      }

      const byId = new Map(updates.filter(Boolean).map((item) => [item.id, item.status]))
      if (byId.size === 0) {
        return
      }

      setDownloads((current) =>
        (current || []).map((row) => {
          if (!byId.has(row.id)) {
            return row
          }
          const nextStatus = byId.get(row.id)
          if (nextStatus === row.status) {
            return row
          }
          return {
            ...row,
            status: nextStatus,
            download_url:
              nextStatus === 'available' ? `/download_zip/${row.id}` : row.download_url,
          }
        }),
      )
    }

    const timer = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [downloads])

  async function handleDelete(id) {
    setDeletingId(id)
    try {
      await deleteDownload(id)
      setDownloads((current) => (current || []).filter((row) => row.id !== id))
    } catch (deleteError) {
      setError(deleteError)
    } finally {
      setDeletingId(null)
    }
  }

  if (error || !downloads) {
    return (
      <PageStatus
        className="od-downloads"
        loading={!error}
        error={error}
        errorMessage="Unable to load downloads."
        loadingMessage="Loading downloads…"
        onRetry={() => setRetryCount((count) => count + 1)}
      />
    )
  }

  if (downloads.length === 0) {
    return <p className="od-downloads">You have no downloads yet.</p>
  }

  return (
    <div className="od-downloads">
      <table className="od-downloads__table">
        <thead>
          <tr>
            <th scope="col">Game</th>
            <th scope="col">File</th>
            <th scope="col">Status</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {downloads.map((row) => (
            <tr key={row.id} data-download-id={row.id}>
              <td>{row.game_name || 'Unknown game'}</td>
              <td>{row.file_name || '—'}</td>
              <td>
                <span data-status={row.status}>{row.status}</span>
              </td>
              <td>
                {row.status === 'available' && row.download_url ? (
                  <a href={row.download_url}>Download</a>
                ) : null}{' '}
                <button
                  type="button"
                  className="od-cbtn od-cbtn--danger"
                  disabled={deletingId === row.id}
                  onClick={() => handleDelete(row.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
