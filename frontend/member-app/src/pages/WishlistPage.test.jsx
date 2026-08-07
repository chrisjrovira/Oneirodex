import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WishlistPage } from './WishlistPage'

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  })
}

beforeEach(() => {
  document.head.innerHTML = '<meta name="csrf-token" content="test-csrf-token">'
  global.fetch = vi.fn()
})

afterEach(() => {
  document.head.innerHTML = ''
  delete global.fetch
})

test('renders requests returned by the API', async () => {
  global.fetch.mockReturnValue(
    jsonResponse({
      requests: [
        {
          id: 1,
          title: 'Hollow Knight: Silksong',
          notes: 'Any edition works',
          status: 'pending',
          created_at: '2026-07-01T12:00:00+00:00',
          linked_game_uuid: null,
        },
      ],
    }),
  )

  render(<WishlistPage shellConfig={{}} />)

  expect(screen.getByText('Loading…')).toBeInTheDocument()
  expect(await screen.findByText('Hollow Knight: Silksong')).toBeInTheDocument()
  expect(screen.getByText('Any edition works')).toBeInTheDocument()
  expect(screen.getByText('pending')).toBeInTheDocument()
  expect(screen.getByText('Jul 1, 2026')).toBeInTheDocument()
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/requests',
    expect.objectContaining({ credentials: 'same-origin' }),
  )
})

test('shows empty state when there are no requests', async () => {
  global.fetch.mockReturnValue(jsonResponse({ requests: [] }))

  render(<WishlistPage shellConfig={{}} />)

  expect(
    await screen.findByText(
      'No requests yet. Add a title above and your librarians will take a look.',
    ),
  ).toBeInTheDocument()
})

test('shows error state with retry', async () => {
  const user = userEvent.setup()
  global.fetch
    .mockReturnValueOnce(jsonResponse({ error: 'nope' }, { ok: false, status: 500 }))
    .mockReturnValue(jsonResponse({ requests: [] }))

  render(<WishlistPage shellConfig={{}} />)

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load wishlist.')
  await user.click(screen.getByRole('button', { name: 'Retry' }))

  expect(
    await screen.findByText(
      'No requests yet. Add a title above and your librarians will take a look.',
    ),
  ).toBeInTheDocument()
})

test('cancelling a pending request sends DELETE with the CSRF header', async () => {
  const user = userEvent.setup()
  global.fetch
    .mockReturnValueOnce(
      jsonResponse({
        requests: [
          { id: 42, title: 'Outer Wilds', notes: null, status: 'pending', created_at: null },
        ],
      }),
    )
    .mockReturnValueOnce(jsonResponse({ ok: true, id: 42 }))
    .mockReturnValue(jsonResponse({ requests: [] }))

  render(<WishlistPage shellConfig={{}} />)

  expect(await screen.findByText('Outer Wilds')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith('/api/requests/42', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': 'test-csrf-token' },
    })
  })

  expect(
    await screen.findByText(
      'No requests yet. Add a title above and your librarians will take a look.',
    ),
  ).toBeInTheDocument()
})

test('librarian can resolve a request and toggle the all-requests view', async () => {
  const user = userEvent.setup()
  global.fetch.mockReturnValue(
    jsonResponse({
      requests: [{ id: 7, title: 'Tunic', notes: null, status: 'pending', created_at: null }],
    }),
  )

  render(<WishlistPage shellConfig={{ isLibrarian: true }} />)

  expect(await screen.findByText('Tunic')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Fulfilled' }))

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith('/api/requests/7', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'X-CSRFToken': 'test-csrf-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'fulfilled' }),
    })
  })

  await user.click(screen.getByRole('checkbox', { name: 'Show everyone’s requests' }))

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/requests?all=1',
      expect.objectContaining({ credentials: 'same-origin' }),
    )
  })
})

test('surfaces a failed create request to the user', async () => {
  const user = userEvent.setup()
  global.fetch
    .mockReturnValueOnce(jsonResponse({ requests: [] }))
    .mockReturnValueOnce(
      jsonResponse(
        { error: 'Wishlist requests are not available for this account' },
        { ok: false, status: 403 },
      ),
    )

  render(<WishlistPage shellConfig={{}} />)

  await screen.findByText(
    'No requests yet. Add a title above and your librarians will take a look.',
  )
  await user.type(screen.getByLabelText('Title'), 'Blasphemous 2')
  await user.click(screen.getByRole('button', { name: 'Request' }))

  expect(
    await screen.findByText('Wishlist requests are not available for this account'),
  ).toBeInTheDocument()
})

test('new chrome moves the request form and the librarian toggle into bar two', async () => {
  const user = userEvent.setup()
  global.fetch.mockReturnValue(jsonResponse({ requests: [] }))

  render(<WishlistPage shellConfig={{ enableNewChrome: true, isLibrarian: true }} />)
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

  expect(screen.queryByRole('heading', { name: 'Wishlist' })).toBeNull()
  // A permanently open request form above the list is furniture, not an action.
  expect(screen.queryByPlaceholderText('Game title')).toBeNull()

  await user.click(screen.getByRole('button', { name: /Request a title/ }))
  expect(screen.getByPlaceholderText('Game title')).toBeInTheDocument()
})

test('the librarian scope toggle stays a real toggle after the move', async () => {
  // It was a checkbox; as a bar-two button it must still report its state, or
  // a librarian cannot tell whose requests they are looking at.
  const user = userEvent.setup()
  global.fetch.mockReturnValue(jsonResponse({ requests: [] }))

  render(<WishlistPage shellConfig={{ enableNewChrome: true, isLibrarian: true }} />)
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())

  const toggle = screen.getByRole('button', { name: /Everyone/ })
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-pressed', 'true')
})

test('members never see the librarian scope toggle', async () => {
  global.fetch.mockReturnValue(jsonResponse({ requests: [] }))
  render(<WishlistPage shellConfig={{ enableNewChrome: true }} />)
  await waitFor(() => expect(screen.queryByText('Loading…')).toBeNull())
  expect(screen.queryByRole('button', { name: /Everyone/ })).toBeNull()
})
