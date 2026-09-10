import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, vi } from 'vitest'

import { useResource, useResourceMutation } from './useResource'

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function Probe({ resource }) {
  const { data, loading, error, reload } = resource
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error ? error.message : ''}</span>
      <span data-testid="data">{data ? JSON.stringify(data) : ''}</span>
      <button type="button" onClick={() => reload()}>
        reload
      </button>
    </div>
  )
}

test('reports loading, then the resolved data', async () => {
  const fetcher = vi.fn().mockResolvedValue({ hello: 'world' })
  function Host() {
    const resource = useResource(['probe'], fetcher)
    return <Probe resource={resource} />
  }

  render(<Host />, { wrapper: makeWrapper() })

  // First synchronous render: nothing cached and a fetch in flight.
  expect(screen.getByTestId('loading')).toHaveTextContent('true')
  await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('{"hello":"world"}'))
  expect(screen.getByTestId('loading')).toHaveTextContent('false')
  expect(screen.getByTestId('error')).toHaveTextContent('')
  expect(fetcher).toHaveBeenCalledTimes(1)
  // The queryFn is handed react-query's context, so `signal` is available.
  expect(fetcher.mock.calls[0][0]).toHaveProperty('signal')
})

test('surfaces the thrown Error, keeping status / error_code for PageStatus', async () => {
  const err = Object.assign(new Error('nope'), { status: 503, error_code: 'unavailable' })
  const fetcher = vi.fn().mockRejectedValue(err)
  function Host() {
    return <Probe resource={useResource(['probe-err'], fetcher)} />
  }

  render(<Host />, { wrapper: makeWrapper() })

  await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('nope'))
  expect(screen.getByTestId('loading')).toHaveTextContent('false')
})

test('reload refetches the resource', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 2 })
  function Host() {
    return <Probe resource={useResource(['probe-reload'], fetcher)} />
  }

  render(<Host />, { wrapper: makeWrapper() })
  await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('{"n":1}'))

  screen.getByRole('button', { name: 'reload' }).click()

  await waitFor(() => expect(screen.getByTestId('data')).toHaveTextContent('{"n":2}'))
  expect(fetcher).toHaveBeenCalledTimes(2)
})

test('the disabled resource never calls its fetcher and never reports loading', () => {
  const fetcher = vi.fn().mockResolvedValue({})
  function Host() {
    return <Probe resource={useResource(['probe-off'], fetcher, { enabled: false })} />
  }

  render(<Host />, { wrapper: makeWrapper() })

  expect(fetcher).not.toHaveBeenCalled()
  expect(screen.getByTestId('loading')).toHaveTextContent('false')
})

test('useResourceMutation invalidates the keys it is given', async () => {
  const readFetcher = vi
    .fn()
    .mockResolvedValueOnce({ v: 'before' })
    .mockResolvedValueOnce({ v: 'after' })
  const writeFn = vi.fn().mockResolvedValue({ ok: true })

  function Host() {
    const resource = useResource(['thing'], readFetcher)
    const save = useResourceMutation(writeFn, { invalidate: [['thing']] })
    return (
      <div>
        <span data-testid="v">{resource.data?.v ?? ''}</span>
        <span data-testid="saving">{String(save.loading)}</span>
        <button type="button" onClick={() => save.mutate({ field: 1 })}>
          save
        </button>
      </div>
    )
  }

  render(<Host />, { wrapper: makeWrapper() })
  await waitFor(() => expect(screen.getByTestId('v')).toHaveTextContent('before'))

  screen.getByRole('button', { name: 'save' }).click()

  await waitFor(() => expect(screen.getByTestId('v')).toHaveTextContent('after'))
  expect(writeFn.mock.calls[0][0]).toEqual({ field: 1 })
  expect(readFetcher).toHaveBeenCalledTimes(2)
})
