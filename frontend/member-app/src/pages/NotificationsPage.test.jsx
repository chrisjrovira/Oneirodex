import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { NotificationsPage } from './NotificationsPage'

function jsonResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      if (String(url).includes('/preferences')) {
        return jsonResponse({
          notify_friend_requests: true,
          notify_activity: true,
          notify_mentions: true,
          notify_chat: true,
          notify_free_games: true,
          email_notify_social: false,
          email_digest_daily: false,
        })
      }
      if (String(url).includes('/notifications/read')) {
        return jsonResponse({ ok: true, marked: 1, unread_count: 0 })
      }
      return jsonResponse({
        notifications: [
          {
            id: 11,
            title: 'Friend request',
            body: 'Alex wants to connect',
            unread: true,
            link: '/activity',
            created_at: '2026-07-20T12:00:00+00:00',
          },
          {
            id: 10,
            title: 'Welcome',
            body: 'You are in',
            unread: false,
            created_at: '2026-07-19T12:00:00+00:00',
          },
        ],
        unread_count: 1,
      })
    }),
  )
})

test('the inbox asks the server for unread, so it cannot disagree with the count', async () => {
  // Filtering one page of rows client-side meant a member with more read
  // notifications than the page size saw an empty Inbox beside a "1 unread"
  // badge, with no way to reach the notification. Inbox is a server query now.
  render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>,
  )

  await screen.findByText('Friend request')
  const listCalls = fetch.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.includes('/api/notifications?'))
  expect(listCalls.length).toBeGreaterThan(0)
  expect(listCalls[0]).toContain('unread=1')
})

test('the inbox holds what is outstanding; read notifications file themselves', async () => {
  // Reading a notification used to change a dot and nothing else, so the list
  // only ever grew. Now it moves: the inbox is what still needs you, and
  // everything seen stays available under Archive rather than being lost.
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>,
  )

  expect(await screen.findByText('Friend request')).toBeInTheDocument()
  expect(screen.queryByText('Welcome')).not.toBeInTheDocument()
  expect(screen.getByText('unread')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mark all read' })).toBeEnabled()

  await user.click(screen.getByRole('button', { name: 'Archive' }))
  expect(screen.getByText('Welcome')).toBeInTheDocument()
  expect(screen.queryByText('Friend request')).not.toBeInTheDocument()
})

test('new chrome moves the filter into bar two and keeps mark-all by the list', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <NotificationsPage shellConfig={{ enableNewChrome: true }} />
    </MemoryRouter>,
  )

  await screen.findByText('Friend request')
  // The heading and lede are gone; the unread count they carried is not.
  expect(screen.queryByRole('heading', { name: 'Notifications' })).toBeNull()
  expect(screen.getByText('1 unread')).toBeInTheDocument()
  // Mark all read is not in the bar (W28): it acts on the list, so it sits on
  // the Inbox heading row directly above it.
  const markAll = screen.getByRole('button', { name: 'Mark all read' })
  expect(markAll).toBeEnabled()
  expect(markAll.closest('.gt-notifications__inbox-head')).not.toBeNull()

  await user.click(screen.getByRole('button', { name: 'Archive' }))
  expect(screen.getByText('Welcome')).toBeInTheDocument()
})

test('keeps preferences collapsed by default', async () => {
  render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>,
  )

  await screen.findByText('Friend request')
  const prefs = screen.getByText('Preferences').closest('details')
  expect(prefs.open).toBe(false)
})

test('shows retry when notifications fail to load', async () => {
  fetch.mockImplementation(() => Promise.reject(new Error('network')))
  render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>,
  )

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load notifications.')
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
})
