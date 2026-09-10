import { useCallback } from 'react'
import {
  hashKey,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type QueryObserverResult,
  type RefetchOptions,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'

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
 * the `QueryClient`; member-app does in its `main` entry, admin-app / ops-glance can
 * adopt this in a later wave once they wrap their trees.
 */

/** The slice of react-query's queryFn context a resource fetcher actually reads. */
export interface ResourceFetchContext {
  queryKey: QueryKey
  signal: AbortSignal
  meta: Record<string, unknown> | undefined
}

export interface UseResourceResult<T> {
  data: T | undefined
  /** Pending *and* actively fetching — first load with nothing cached. */
  loading: boolean
  error: Error | null
  reload: () => Promise<void>
  refetch: (options?: RefetchOptions) => Promise<QueryObserverResult<T, Error>>
  isFetching: boolean
  isSuccess: boolean
}

/** `useQuery` options minus the two this hook owns. */
export type UseResourceOptions<T> = Omit<
  UseQueryOptions<T, Error, T, QueryKey>,
  'queryKey' | 'queryFn'
>

export function useResource<T = unknown>(
  key: QueryKey,
  fetcher: (context: ResourceFetchContext) => Promise<T>,
  opts: UseResourceOptions<T> = {},
): UseResourceResult<T> {
  const queryClient = useQueryClient()
  const keyHash = hashKey(key)

  const query = useQuery<T, Error, T, QueryKey>({
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
 */

export interface UseResourceMutationOptions<TData, TVars> extends Omit<
  UseMutationOptions<TData, Error, TVars>,
  'mutationFn'
> {
  /** Query keys to invalidate (and refetch) once the mutation resolves. */
  invalidate?: QueryKey[]
}

export interface UseResourceMutationResult<TData, TVars> {
  mutate: (variables: TVars) => void
  mutateAsync: (variables: TVars) => Promise<TData>
  loading: boolean
  error: Error | null
  data: TData | undefined
  reset: () => void
}

export function useResourceMutation<TData = unknown, TVars = void>(
  mutationFn: (variables: TVars) => Promise<TData>,
  opts: UseResourceMutationOptions<TData, TVars> = {},
): UseResourceMutationResult<TData, TVars> {
  const { invalidate = [], onSuccess, ...rest } = opts
  const queryClient = useQueryClient()

  const mutation = useMutation<TData, Error, TVars>({
    mutationFn,
    onSuccess: async (data, variables, onMutateResult, context) => {
      if (invalidate.length > 0) {
        await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      }
      return onSuccess?.(data, variables, onMutateResult, context)
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
