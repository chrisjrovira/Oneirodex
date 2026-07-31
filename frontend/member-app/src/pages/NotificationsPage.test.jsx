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

test('renders dense inbox with unread marker and filter', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>,
  )

  expect(await screen.findByText('Friend request')).toBeInTheDocument()
  expect(screen.getByText('Welcome')).toBeInTheDocument()
  expect(screen.getByText('unread')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mark all read' })).toBeEnabled()

  await user.click(screen.getByRole('button', { name: 'Unread' }))
  expect(screen.getByText('Friend request')).toBeInTheDocument()
  expect(screen.queryByText('Welcome')).not.toBeInTheDocument()
})

test('keeps alert preferences collapsed by default', async () => {
  render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>,
  )

  await screen.findByText('Friend request')
  const prefs = screen.getByText('Alert preferences').closest('details')
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
