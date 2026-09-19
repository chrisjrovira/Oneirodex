import { useState, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ShellConfigProvider, ViewerProvider } from '@oneirodex/ui'

/**
 * Test harness for the Wave B1.6 contexts.
 *
 * member-app pages used to take a `shellConfig` prop; they now read
 * `useShellConfig()` / `useViewer()`, both of which throw outside their
 * provider. Component tests that render a page directly wrap it in this instead
 * of passing the prop:
 *
 *   render(<NewsPage />, { wrapper: shellWrapper({ enableNewChrome: true }) })
 *
 * `shell` is the ShellConfig value verbatim; the viewer is derived from the
 * same object unless `viewer` overrides it. Pass `router` for pages that also
 * need a Router in scope.
 *
 * Wave B1.3: also provides a fresh `QueryClient` per render (retries off, so a
 * `mockRejectedValueOnce` → `mockResolvedValueOnce` retry test sees the error
 * rather than react-query silently swallowing it). Pages that adopt
 * `useResource` need the provider; pages that do not are unaffected.
 */
export interface ShellHarnessProps {
  /** The ShellConfig value, verbatim. */
  shell?: Record<string, unknown>
  /** Viewer override; derived from `shell` when absent. */
  viewer?: Record<string, unknown>
  router?: boolean
  initialEntries?: string[]
  children?: ReactNode
}

export function ShellHarness({
  shell = {},
  viewer,
  router = false,
  initialEntries,
  children,
}: ShellHarnessProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      }),
  )
  const tree = (
    <ViewerProvider value={(viewer ?? shell) as any}>
      <ShellConfigProvider value={shell as any}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ShellConfigProvider>
    </ViewerProvider>
  )
  if (!router) return tree
  return <MemoryRouter initialEntries={initialEntries}>{tree}</MemoryRouter>
}

export function shellWrapper(
  shell: Record<string, unknown> = {},
  options: Omit<ShellHarnessProps, 'shell' | 'children'> = {},
) {
  return function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <ShellHarness shell={shell} {...options}>
        {children}
      </ShellHarness>
    )
  }
}
