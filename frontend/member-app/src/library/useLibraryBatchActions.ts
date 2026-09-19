import { useMemo, useState } from 'react'
import {
  batchAddToWishlist,
  batchCheckFreshness,
  batchRefreshImages,
  batchSetFavorite,
  batchSetPlayStatus,
} from '../api/batchActions'
import { batchItemUuids, summarizeBatchOutcome } from '../utils/batchOutcome'
import { showToast } from '../utils/toast'
import { errorMessage, type BatchRow, type BrowseResult } from './libraryTypes'

/* Batch actions pulled out of LibraryApp (v11 cycle, H-D.2); bodies unchanged. */

/** Favourite / freshness / wishlist / play-status / cover-refresh over the selection. */
export function useLibraryBatchActions({
  result,
  setResult,
  selectedIds,
  canBatchRefreshImages,
  t,
}: {
  result: BrowseResult | null
  setResult: (update: (prev: BrowseResult | null) => BrowseResult | null) => void
  selectedIds: Set<string>
  canBatchRefreshImages: boolean
  t: (key: string) => string
}) {
  /** UUIDs known to have a pending wishlist request (session + batch skips). */
  const [wishlistPendingIds, setWishlistPendingIds] = useState<Set<string>>(() => new Set())
  const [selectionBusy, setSelectionBusy] = useState(false)
  const [wishlistAvailable, setWishlistAvailable] = useState(true)
  const [playStatusAvailable, setPlayStatusAvailable] = useState(true)
  const [refreshImagesAvailable, setRefreshImagesAvailable] = useState(true)

  const favoriteByUuid = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const game of result?.games ?? []) {
      map[game.uuid] = Boolean(game.is_favorite)
    }
    return map
  }, [result])

  const applyFavoriteResults = (uuids: any, favorite: any) => {
    const idSet = new Set(uuids)
    setResult((prev) => {
      if (!prev?.games) {
        return prev
      }
      return {
        ...prev,
        games: prev.games.map((game) =>
          idSet.has(game.uuid) ? { ...game, is_favorite: favorite } : game,
        ),
      }
    })
  }

  const applyPlayStatusResults = (updatedRows: any, status: any) => {
    const byUuid = new Map()
    if (Array.isArray(updatedRows)) {
      for (const row of updatedRows) {
        if (typeof row === 'string' && row) {
          byUuid.set(row, status)
          continue
        }
        if (row && typeof row === 'object' && typeof row.uuid === 'string') {
          byUuid.set(row.uuid, row.status !== undefined ? row.status : status)
        }
      }
    }
    if (byUuid.size === 0) {
      return
    }
    setResult((prev) => {
      if (!prev?.games) {
        return prev
      }
      return {
        ...prev,
        games: prev.games.map((game) =>
          byUuid.has(game.uuid) ? { ...game, user_status: byUuid.get(game.uuid) || '' } : game,
        ),
      }
    })
  }

  const runBatchFavorite = async (favorite: any) => {
    const uuids = Array.from(selectedIds)
    if (uuids.length === 0 || selectionBusy) {
      return
    }
    setSelectionBusy(true)
    try {
      const outcome = await batchSetFavorite(uuids, favorite, { favoriteByUuid })
      applyFavoriteResults(batchItemUuids(outcome.updated), favorite)
      const summary = summarizeBatchOutcome(outcome, {
        actionLabel: favorite ? t('Favorites') : t('Unfavorite'),
        t,
      })
      showToast(summary.message, summary.tone)
    } catch (err) {
      showToast(errorMessage(err) || t('Favorite update failed'), 'error')
    } finally {
      setSelectionBusy(false)
    }
  }

  const runBatchFreshness = async () => {
    const uuids = Array.from(selectedIds)
    if (uuids.length === 0 || selectionBusy) {
      return
    }
    setSelectionBusy(true)
    try {
      const outcome = await batchCheckFreshness(uuids)
      const updatedRows = outcome.updated || outcome.results || []
      if (Array.isArray(updatedRows) && updatedRows.length > 0) {
        const byUuid = new Map(
          updatedRows.filter((row) => row && row.uuid).map((row) => [row.uuid, row]),
        )
        if (byUuid.size > 0) {
          setResult((prev) => {
            if (!prev?.games) {
              return prev
            }
            return {
              ...prev,
              games: prev.games.map((game) => {
                const row = byUuid.get(game.uuid)
                if (!row) {
                  return game
                }
                return {
                  ...game,
                  freshness_status: row.status ?? row.freshness_status ?? game.freshness_status,
                  freshness_confidence:
                    row.confidence ?? row.freshness_confidence ?? game.freshness_confidence,
                }
              }),
            }
          })
        }
      }
      const summary = summarizeBatchOutcome(outcome, {
        actionLabel: t('Freshness'),
        t,
      })
      showToast(summary.message, summary.tone)
    } catch (err) {
      showToast(errorMessage(err) || t('Freshness refresh failed'), 'error')
    } finally {
      setSelectionBusy(false)
    }
  }

  const runBatchWishlist = async (remove = false) => {
    const uuids = Array.from(selectedIds)
    if (uuids.length === 0 || selectionBusy || !wishlistAvailable) {
      return
    }
    setSelectionBusy(true)
    try {
      const outcome = await batchAddToWishlist(uuids, {
        action: remove ? 'remove' : 'add',
      })
      const touched = new Set([
        ...batchItemUuids(outcome.updated),
        ...(outcome.skipped || [])
          .filter((row: BatchRow) => row?.reason === 'already_pending' && row.uuid)
          .map((row: BatchRow) => row.uuid),
      ])
      if (touched.size) {
        setWishlistPendingIds((prev) => {
          const next = new Set(prev)
          touched.forEach((uuid) => {
            if (remove) next.delete(uuid)
            else next.add(uuid)
          })
          return next
        })
      }
      const summary = summarizeBatchOutcome(outcome, {
        actionLabel: remove ? t('Remove from wishlist') : t('Wishlist'),
        t,
      })
      showToast(summary.message, summary.tone)
    } catch (err: any) {
      if (err?.unavailable) {
        setWishlistAvailable(false)
      }
      showToast(err?.message || t('Wishlist update failed'), 'error')
    } finally {
      setSelectionBusy(false)
    }
  }

  const runBatchPlayStatus = async (status: any) => {
    const uuids = Array.from(selectedIds)
    if (uuids.length === 0 || selectionBusy || !playStatusAvailable) {
      return
    }
    setSelectionBusy(true)
    try {
      const outcome = await batchSetPlayStatus(uuids, status)
      applyPlayStatusResults(outcome.updated, status)
      const summary = summarizeBatchOutcome(outcome, {
        actionLabel: t('Play status'),
        t,
      })
      showToast(summary.message, summary.tone)
    } catch (err: any) {
      if (err?.unavailable) {
        setPlayStatusAvailable(false)
      }
      showToast(err?.message || t('Play status update failed'), 'error')
    } finally {
      setSelectionBusy(false)
    }
  }

  const runBatchRefreshImages = async () => {
    const uuids = Array.from(selectedIds)
    if (uuids.length === 0 || selectionBusy || !canBatchRefreshImages || !refreshImagesAvailable) {
      return
    }
    setSelectionBusy(true)
    try {
      const outcome = await batchRefreshImages(uuids)
      const summary = summarizeBatchOutcome(outcome, {
        actionLabel: t('Refresh covers'),
        successVerb: 'queued',
        t,
      })
      showToast(summary.message, summary.tone)
    } catch (err: any) {
      if (err?.unavailable) {
        setRefreshImagesAvailable(false)
      }
      showToast(err?.message || t('Cover refresh failed'), 'error')
    } finally {
      setSelectionBusy(false)
    }
  }

  return {
    favoriteByUuid,
    wishlistPendingIds,
    selectionBusy,
    wishlistAvailable,
    playStatusAvailable,
    refreshImagesAvailable,
    runBatchFavorite,
    runBatchFreshness,
    runBatchWishlist,
    runBatchPlayStatus,
    runBatchRefreshImages,
  }
}
