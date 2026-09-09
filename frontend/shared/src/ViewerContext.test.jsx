import { render, renderHook, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { ViewerProvider, useViewer, viewerFromConfig } from './ViewerContext.jsx'
import { ShellConfigProvider, useShellConfig } from './ShellConfigContext.jsx'

test('viewerFromConfig derives the predicates from role and flags', () => {
  expect(viewerFromConfig({ role: 'admin' })).toMatchObject({
    role: 'admin',
    isAdmin: true,
    isLibrarian: false,
    isChild: false,
  })
  expect(viewerFromConfig({ isLibrarian: true, role: 'user' })).toMatchObject({
    isAdmin: false,
    isLibrarian: true,
  })
  expect(viewerFromConfig({ role: 'child' }).isChild).toBe(true)
})

test('viewerFromConfig fills identity defaults', () => {
  expect(viewerFromConfig()).toEqual({
    userId: null,
    role: 'user',
    isAdmin: false,
    isLibrarian: false,
    isChild: false,
    locale: 'en',
  })
})

test('useViewer returns the normalised viewer from the provider', () => {
  const { result } = renderHook(() => useViewer(), {
    wrapper: ({ children }) => (
      <ViewerProvider value={{ userId: 7, role: 'admin', locale: 'fr' }}>{children}</ViewerProvider>
    ),
  })
  expect(result.current).toEqual({
    userId: 7,
    role: 'admin',
    isAdmin: true,
    isLibrarian: false,
    isChild: false,
    locale: 'fr',
  })
})

test('useViewer throws a clear error outside a provider', () => {
  expect(() => renderHook(() => useViewer())).toThrow(/within a <ViewerProvider>/)
})

test('useShellConfig hands back the bootstrap object as-is', () => {
  const value = { perPage: 40, tileSize: 'L', currentFilters: { platform: 'snes' } }
  const { result } = renderHook(() => useShellConfig(), {
    wrapper: ({ children }) => <ShellConfigProvider value={value}>{children}</ShellConfigProvider>,
  })
  expect(result.current).toBe(value)
})

test('useShellConfig throws a clear error outside a provider', () => {
  expect(() => renderHook(() => useShellConfig())).toThrow(/within a <ShellConfigProvider>/)
})

test('the two providers compose without colliding', () => {
  function Probe() {
    const viewer = useViewer()
    const shell = useShellConfig()
    return <span>{`${viewer.isAdmin}:${shell.perPage}`}</span>
  }
  render(
    <ViewerProvider value={{ role: 'admin' }}>
      <ShellConfigProvider value={{ perPage: 25 }}>
        <Probe />
      </ShellConfigProvider>
    </ViewerProvider>,
  )
  expect(screen.getByText('true:25')).toBeInTheDocument()
})
