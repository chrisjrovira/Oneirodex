import { render, screen, within } from '@testing-library/react'

import { InvitesPage } from './InvitesPage'

function mockFetch(body) {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => body }))
}

/**
 * The Invites readiness strip (UID-014).
 *
 * The totals it shows are summed in the component, and the summing has to
 * survive rows the API returns without a quota — an account that has never had
 * one omits the field rather than sending zero. `undefined` in a running total
 * poisons it to NaN, and "NaN unused tokens" is worse than no strip at all,
 * so that guard is what these pin.
 */
test('sums invite totals across users', async () => {
  const originalFetch = global.fetch
  global.fetch = mockFetch({
    users: [
      { user_id: 'a', name: 'Ada', role: 'admin', invite_quota: 10, unused_invites: 3 },
      { user_id: 'b', name: 'Brin', role: 'user', invite_quota: 5, unused_invites: 2 },
    ],
  })
  try {
    render(<InvitesPage />)

    const strip = await screen.findByLabelText('Invites')
    expect(within(strip).getByText('5')).toBeInTheDocument() // 3 + 2 unused
    expect(within(strip).getByText('15')).toBeInTheDocument() // 10 + 5 quota
  } finally {
    global.fetch = originalFetch
  }
})

test('a user with no quota fields counts as zero, not NaN', async () => {
  const originalFetch = global.fetch
  global.fetch = mockFetch({
    users: [
      { user_id: 'a', name: 'Ada', role: 'admin', invite_quota: 4, unused_invites: 1 },
      // No invite_quota / unused_invites at all — the shape the API returns for
      // an account that has never been given a quota.
      { user_id: 'b', name: 'Brin', role: 'user' },
    ],
  })
  try {
    render(<InvitesPage />)

    const strip = await screen.findByLabelText('Invites')
    expect(within(strip).queryByText(/NaN/)).toBeNull()
    expect(within(strip).getByText('4')).toBeInTheDocument()
  } finally {
    global.fetch = originalFetch
  }
})

test('warns when nobody can invite anyone', async () => {
  const originalFetch = global.fetch
  global.fetch = mockFetch({
    users: [{ user_id: 'a', name: 'Ada', role: 'admin', invite_quota: 2, unused_invites: 0 }],
  })
  try {
    render(<InvitesPage />)

    // Zero unused tokens means invites are effectively closed for the whole
    // household — a fact the per-user table states only by making you add up
    // a column yourself.
    const strip = await screen.findByLabelText('Invites')
    expect(within(strip).getByText('Unused tokens')).toBeInTheDocument()
  } finally {
    global.fetch = originalFetch
  }
})
