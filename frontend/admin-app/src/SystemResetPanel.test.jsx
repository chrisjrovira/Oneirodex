import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'

import { SystemResetPanel } from './SystemResetPanel'

/** Real numbers from the server for this schema — see tests/test_system_reset.py. */
const SCOPE_COUNTS = {
  catalog: 40,
  libraries: 45,
  users: 44,
  settings: 7,
}

/**
 * Answer preview calls with the count for whichever scope was asked for, and
 * record every request so a test can assert nothing destructive was sent.
 */
function mockApi({ onPerform } = {}) {
  const calls = []
  global.fetch = vi.fn(async (_url, options) => {
    const body = JSON.parse(options.body)
    calls.push(body)

    if (body.confirm !== undefined) {
      return (
        onPerform?.(body) ?? {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            performed: true,
            table_count: 40,
            actor_restored: false,
          }),
        }
      )
    }

    const tables = body.scopes.reduce((n, s) => n + (SCOPE_COUNTS[s] || 0), 0)
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        performed: false,
        touches_files: false,
        scopes: body.scopes,
        tables: [],
        cascaded: [],
        table_count: tables,
      }),
    }
  })
  return calls
}

afterEach(() => {
  vi.restoreAllMocks()
})

async function acknowledgeReset(user) {
  await user.click(
    screen.getByRole('checkbox', {
      name: /I understand this cannot be undone/i,
    }),
  )
}

test('each scope shows its real blast radius before anything is ticked', async () => {
  // The point of the counts: "Member accounts" sounds like it clears members,
  // and actually clears 44 tables because everything recording *who did it*
  // carries a user reference. That number has to be on screen before the
  // choice, not inside the plan the operator opens afterwards.
  mockApi()
  render(<SystemResetPanel />)

  await waitFor(() => {
    expect(screen.getByText('clears 44 tables')).toBeInTheDocument()
  })
  expect(screen.getByText('clears 40 tables')).toBeInTheDocument()
  expect(screen.getByText('clears 45 tables')).toBeInTheDocument()
  expect(screen.getByText('clears 7 tables')).toBeInTheDocument()
})

test('the users scope label does not undersell what it clears', async () => {
  mockApi()
  render(<SystemResetPanel />)

  // Whatever the wording, it must not read as members-only.
  const label = screen.getByText(/Member accounts/i)
  expect(label.textContent).toMatch(/everything linked to a member/i)

  // Let the mount's count fetches settle before unmounting, or their state
  // update lands outside act() and warns on an otherwise passing test.
  await waitFor(() => expect(screen.getByText('clears 44 tables')).toBeInTheDocument())
})

test('mounting only previews — it never sends a confirm', async () => {
  const calls = mockApi()
  render(<SystemResetPanel />)

  await waitFor(() => expect(calls.length).toBe(4))
  expect(calls.every((c) => c.confirm === undefined)).toBe(true)
})

test('ticking libraries also ticks the catalog it implies', async () => {
  mockApi()
  const user = userEvent.setup()
  render(<SystemResetPanel />)

  await acknowledgeReset(user)
  await user.click(screen.getByRole('checkbox', { name: /Library definitions/i }))

  expect(screen.getByRole('checkbox', { name: /Library definitions/i })).toBeChecked()
  // Clearing library rows while their games still point at them is not a
  // choice the operator gets to make — the server implies it, and the UI has
  // to show it at tick time rather than reveal it in the plan.
  expect(screen.getByRole('checkbox', { name: /Library catalog/i })).toBeChecked()
})

test('the reset button stays unavailable until the phrase matches exactly', async () => {
  mockApi()
  const user = userEvent.setup()
  render(<SystemResetPanel />)

  await acknowledgeReset(user)
  await user.click(screen.getByRole('checkbox', { name: /Library catalog/i }))
  await user.click(screen.getByRole('button', { name: /show me what this clears/i }))

  const confirmField = await screen.findByRole('textbox')
  const resetButton = screen.getByRole('button', { name: /reset now/i })

  expect(resetButton).toBeDisabled()

  await user.type(confirmField, 'reset oneirodex')
  expect(resetButton).toBeDisabled() // case matters

  await user.clear(confirmField)
  await user.type(confirmField, 'RESET ONEIRODEX')
  expect(resetButton).toBeEnabled()
})

test('the legacy RESET ONEIRODEX phrase still unlocks the button', async () => {
  mockApi()
  const user = userEvent.setup()
  render(<SystemResetPanel />)

  await acknowledgeReset(user)
  await user.click(screen.getByRole('checkbox', { name: /Library catalog/i }))
  await user.click(screen.getByRole('button', { name: /show me what this clears/i }))

  const confirmField = await screen.findByRole('textbox')
  const resetButton = screen.getByRole('button', { name: /reset now/i })

  await user.type(confirmField, 'RESET ONEIRODEX')
  expect(resetButton).toBeEnabled()
})

test('changing the selection invalidates a plan already shown', async () => {
  mockApi()
  const user = userEvent.setup()
  render(<SystemResetPanel />)

  await acknowledgeReset(user)
  await user.click(screen.getByRole('checkbox', { name: /Library catalog/i }))
  await user.click(screen.getByRole('button', { name: /show me what this clears/i }))
  expect(await screen.findByRole('textbox')).toBeInTheDocument()

  // Confirming against a stale plan would confirm a different reset than the
  // one on screen, so the plan and the typed phrase both have to go.
  await user.click(screen.getByRole('checkbox', { name: /Member accounts/i }))

  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByRole('button', { name: /reset now/i })).toBeNull()
})
