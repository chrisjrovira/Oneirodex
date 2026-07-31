import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlaytimePage } from './PlaytimePage'
import * as playtimeApi from '../api/playtime'

vi.mock('../api/playtime', () => ({
  fetchMyPlaytime: vi.fn(),
}))

beforeEach(() => {
  playtimeApi.fetchMyPlaytime.mockReset()
  playtimeApi.fetchMyPlaytime.mockResolvedValue({
    total_seconds: 3661,
    games: [
      {
        game_uuid: 'abc',
        game_name: 'Hades',
        total_seconds: 3661,
        session_count: 2,
        last_played_at: '2026-07-20T12:00:00+00:00',
      },
    ],
  })
})

test('lists dense playtime rows with duration meta', async () => {
  render(<PlaytimePage />)
  expect(screen.getByText('Loading…')).toBeInTheDocument()
  expect(await screen.findByText('Hades')).toBeInTheDocument()
  expect(screen.getByLabelText('Playtime summary')).toHaveTextContent(/1h 01m/)
  expect(screen.getByText(/2 sessions/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Hades/i })).toHaveAttribute(
    'href',
    '/game_details/abc',
  )
})

test('shows honest empty state', async () => {
  playtimeApi.fetchMyPlaytime.mockResolvedValue({ total_seconds: 0, games: [] })
  render(<PlaytimePage />)
  expect(
    await screen.findByText(/No playtime recorded yet/i),
  ).toBeInTheDocument()
})

test('Retry reloads after error', async () => {
  const user = userEvent.setup()
  playtimeApi.fetchMyPlaytime
    .mockRejectedValueOnce(new Error('playtime 502'))
    .mockResolvedValueOnce({ total_seconds: 0, games: [] })

  render(<PlaytimePage />)
  expect(await screen.findByRole('alert')).toHaveTextContent(/Unable to load playtime/i)
  await user.click(screen.getByRole('button', { name: /Retry/i }))
  await waitFor(() => {
    expect(screen.getByText(/No playtime recorded yet/i)).toBeInTheDocument()
  })
})
