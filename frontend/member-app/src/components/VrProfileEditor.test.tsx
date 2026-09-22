import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { VrProfileEditor } from './VrProfileEditor'
import { stubFetch } from '../testJsonResponse'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('a librarian records a community profile page; the PUT carries only catalogue fields', async () => {
  const calls: { url: string; method: string; body: Record<string, unknown> }[] = []
  stubFetch(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method || 'GET').toUpperCase()
    const body = init?.body ? JSON.parse(String(init.body)) : {}
    calls.push({ url, method, body })
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        vr_profiles: [
          {
            kind: 'injector',
            runtime: 'openvr',
            profile_url: body.profile_url,
            notes: '',
            source: 'librarian',
          },
        ],
      }),
    }
  })
  const user = userEvent.setup()
  render(<VrProfileEditor gameUuid="g1" initial={[]} />)
  await user.click(screen.getByRole('button', { name: 'Add headset record' }))
  await user.selectOptions(screen.getByLabelText('Runtime'), 'openvr')
  await user.type(screen.getByLabelText('Profile page (http(s) only)'), 'https://example.invalid/p')
  await user.click(screen.getByRole('button', { name: 'Save record' }))
  await waitFor(() => expect(calls.length).toBe(1))
  expect(calls[0].method).toBe('PUT')
  expect(calls[0].url).toMatch(/\/api\/games\/g1\/vr_profiles\/injector$/)
  expect(calls[0].body).toEqual({
    runtime: 'openvr',
    profile_url: 'https://example.invalid/p',
    notes: null,
  })
  expect(await screen.findByRole('button', { name: 'Update record' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
})
