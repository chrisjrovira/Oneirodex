import { useCallback } from 'react'
import { hashKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

/**
 * `useResource` — the shared read hook for SPA pages, `@oneirodex/ui`.
 *
 * Wave B1.3. ~27 member-app pages hand-roll the same shape: `useState` for
 * `data` / `loading` / `error`, a `useEffect` that news up an `AbortController`
 * and calls one `api/` fetcher, and a `reloadCount` integer bumped to force a
 * refetch. That is `@tanstack/react-query`'s job. This is a thin wrapper over
 * `useQuery` that hands a page back exactly the four things it was tracking by
 * hand, so the migration is a delete, not a rewrite:
 *
 *   const { data, loading, error, reload } = useResource(
 *     ['wishlist'],
 *     ({ signal }) => fetchWishlist({ signal }),
 *     { enabled },
 *   )
 *   <PageStatus loading={loading} error={error} onRetry={reload}>…</PageStatus>
 *
 *   - `loading` is `isPending && isFetching` — a spinner only when there is
 *     nothing on screen yet, never on a background refresh (that is what
 *     `PageStatus` already assumes: error → loading → empty → children).
 *   - `error` is the thrown `Error`, carrying `status` / `error_code` from
 *     `errorFromResponse`, so `PageStatus`'s `resolveErrorDetail` still works.
 *   - `reload` invalidates this key, which refetches every active query under
 *     it — the `reloadCount` bump, but real.
 *
 * The queryFn receives react-query's context (`{ queryKey, signal, meta }`), so
 * a fetcher written as `() => fetchThing()` keeps working and one written as
 * `({ signal }) => fetchThing({ signal })` gets abort-on-unmount for free.
 *
 * `opts` is passed straight through to `useQuery` (`enabled`, `staleTime`,
 * `select`, …). The one `@oneirodex/ui`-shaped default is that pages provide
 * the `QueryClient`; member-app does in `main.jsx`, admin-app / ops-glance can
 * adopt this in a later wave once they wrap their trees.
 *
 * @template T
 * @param {readonly unknown[]} key           react-query queryKey
 * @param {(context: object) => Promise<T>} fetcher
 * @param {object} [opts]                     forwarded to `useQuery`
 * @returns {{ data: T | undefined, loading: boolean, error: Error | null,
 *            reload: () => Promise<void>, refetch: Function, isFetching: boolean,
 *            isSuccess: boolean }}
 */
export function useResource(key, fetcher, opts = {}) {
  const queryClient = useQueryClient()
  const keyHash = hashKey(key)

  const query = useQuery({
    queryKey: key,
    queryFn: (context) => fetcher(context),
    ...opts,
  })

  const reload = useCallback(
    () => queryClient.invalidateQueries({ queryKey: key }),
    // `key` is an array literal rebuilt every render; its hash is the stable dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, keyHash],
  )

  return {
    data: query.data,
    // Pending *and* actively fetching — i.e. first load with nothing cached.
    // A background refresh of already-rendered data keeps `loading` false so
    // `PageStatus` shows the stale data, not a takeover spinner.
    loading: query.isPending && query.isFetching,
    error: query.error ?? null,
    reload,
    refetch: query.refetch,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
  }
}

/**
 * `useResourceMutation` — the write half, `@oneirodex/ui`.
 *
 * A thin `useMutation` wrapper for the pages whose delete / create / resolve
 * action used to end in a `reloadCount` bump. Pass the query keys the write
 * invalidates and it does the refetch for you on success:
 *
 *   const cancel = useResourceMutation((id) => deleteRequest(id), {
 *     invalidate: [['wishlist']],
 *   })
 *   await cancel.mutateAsync(rowId)   // row list refetches when this resolves
 *
 * `invalidate` is a list of query keys (each key is itself an array). Every
 * remaining option is forwarded to `useMutation`; a caller-supplied `onSuccess`
 * runs after the invalidations.
 *
 * @param {Function} mutationFn
 * @param {{ invalidate?: readonly (readonly unknown[])[] } & object} [opts]
 */
export function useResourceMutation(mutationFn, opts = {}) {
  const { invalidate = [], onSuccess, ...rest } = opts
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn,
    onSuccess: async (data, variables, context) => {
      if (invalidate.length > 0) {
        await Promise.all(
          invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        )
      }
      return onSuccess?.(data, variables, context)
    },
    ...rest,
  })

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.error ?? null,
    data: mutation.data,
    reset: mutation.reset,
  }
}
