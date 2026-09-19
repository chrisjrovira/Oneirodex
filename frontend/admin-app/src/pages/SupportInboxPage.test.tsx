import { render, screen, within } from '@testing-library/react'

import { SupportInboxPage } from './SupportInboxPage'

function mockFetch(tickets: any) {
  return vi.fn(async (): Promise<any> => ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),

    text: async function () {
      return JSON.stringify(await this.json())
    },
    json: async () => ({ tickets }),
  }))
}

/**
 * The Support readiness strip (UID-014).
 *
 * Open is the count that decides whether this page needs anyone's attention,
 * so it is the one that carries a tone. These pin that open and resolved are
 * counted from the ticket list rather than tracked separately — a second piece
 * of state would be one more thing to keep in step with the rows it describes.
 */
test('counts open, resolved and GitHub-synced tickets', async () => {
  const originalFetch = globalThis.fetch
  // Counts chosen so all three differ — open 3, resolved 1, synced 2. With two
  // tiles showing the same number a getByText would match both and throw,
  // which says nothing about whether the right tile holds the right value.
  globalThis.fetch = mockFetch([
    { id: 1, status: 'open', title: 'A', github_issue_number: 11 },
    { id: 2, status: 'open', title: 'B' },
    { id: 3, status: 'open', title: 'C', github_issue_number: 13 },
    { id: 4, status: 'resolved', title: 'D' },
  ]) as unknown as typeof globalThis.fetch
  try {
    render(<SupportInboxPage />)

    const strip = await screen.findByLabelText('Support')
    expect(within(strip).getByText('Open')).toBeInTheDocument()
    expect(within(strip).getByText('3')).toBeInTheDocument() // three open
    expect(within(strip).getByText('1')).toBeInTheDocument() // one resolved
    expect(within(strip).getByText('2')).toBeInTheDocument() // two on GitHub
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('an empty inbox is a good state, not an empty one', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockFetch([]) as unknown as typeof globalThis.fetch
  try {
    render(<SupportInboxPage />)

    // MetricStrip drops rows whose value is undefined, so a zero count has to
    // stay a rendered zero — "no open tickets" is the answer someone came for,
    // and a strip that vanished would read as the page failing to load.
    const strip = await screen.findByLabelText('Support')
    expect(within(strip).getByText('Open')).toBeInTheDocument()
  } finally {
    globalThis.fetch = originalFetch
  }
})
