import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchFriendsList,
  fetchSocialStatus,
} from './socialCompanionApi'

/**
 * Live friends + presence for the stay-open social companion.
 */
export function useSocialCompanion({ enabled = true } = {}) {
  const [friends, setFriends] = useState([])
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(Boolean(enabled))

  const reload = useCallback(async ({ signal } = {}) => {
    if (!enabled) return
    try {
      const [friendData, socialStatus] = await Promise.all([
        fetchFriendsList({ signal }),
        fetchSocialStatus({ signal }),
      ])
      setFriends(Array.isArray(friendData?.friends) ? friendData.friends : [])
      setStatus(socialStatus)
      setError(null)
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setError(err)
      }
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return undefined
    const controller = new AbortController()
    setLoading(true)
    void reload({ signal: controller.signal })

    let source
    let sseLive = false
    let timer = 0

    function poll() {
      void reload()
    }

    function startPoll() {
      window.clearInterval(timer)
      timer = window.setInterval(poll, sseLive ? 120000 : 30000)
    }

    try {
      source = new EventSource('/api/activity/stream')
      source.addEventListener('hello', () => {
        sseLive = true
        startPoll()
      })
      source.addEventListener('presence', () => {
        sseLive = true
        void reload()
      })
      source.addEventListener('activity', () => {
        sseLive = true
        void reload()
      })
      source.onerror = () => {
        sseLive = false
        startPoll()
      }
    } catch {
      source = null
      sseLive = false
    }
    startPoll()

    return () => {
      controller.abort()
      window.clearInterval(timer)
      source?.close()
    }
  }, [enabled, reload])

  const accepted = useMemo(
    () => friends.filter((row) => row.status === 'accepted'),
    [friends],
  )
  const pendingIncoming = useMemo(
    () => friends.filter((row) => row.direction === 'incoming' && row.status === 'pending'),
    [friends],
  )
  const onlineCount = useMemo(
    () =>
      accepted.filter((row) => {
        const presence = row.user?.presence?.status
        return presence === 'online' || presence === 'in-game' || presence === 'away'
      }).length,
    [accepted],
  )

  return {
    friends,
    accepted,
    pendingIncoming,
    status,
    onlineCount,
    pendingCount: status?.pending_incoming ?? pendingIncoming.length,
    nowPlaying: Array.isArray(status?.now_playing) ? status.now_playing : [],
    loading,
    error,
    reload,
  }
}
