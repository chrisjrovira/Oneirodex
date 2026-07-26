import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GameDetailsPage } from './GameDetailsPage'

const detailsPayload = {
  uuid: '11111111-1111-4111-8111-111111111111',
  name: 'Celeste',
  summary: 'Climb the mountain.',
  cover_url: '/static/newstyle/default_cover.jpg',
  size: '1.2 GB',
  developer: 'Maddy Makes Games',
  genres: ['Platform'],
  screenshots: [],
  urls: [],
  video_urls: [],
  lifecycle_state: 'downloaded',
  client_connected: true,
  playtime: { total_seconds: 3600, session_count: 2 },
  library_platform: 'PCWIN',
  library_platform_label: 'PC Windows',
}

beforeEach(() => {
  global.fetch = vi.fn((url) => {
    if (String(url).includes('/details')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(detailsPayload),
      })
    }
    if (String(url).includes('/versions')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            versions: [{ kind: 'base', id: 1, label: 'Base game', is_default: true }],
          }),
      })
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
  })
})

test('loads game details into SPA page with action bar', async () => {
  render(
    <MemoryRouter initialEntries={[`/game_details/${detailsPayload.uuid}`]}>
      <Routes>
        <Route path="/game_details/:gameUuid" element={<GameDetailsPage />} />
        <Route path="/library" element={<div>Library</div>} />
      </Routes>
    </MemoryRouter>,
  )

  expect(await screen.findByRole('heading', { name: 'Celeste' })).toBeInTheDocument()
  expect(screen.getByText('Climb the mountain.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Install$/i })).toBeInTheDocument()
  expect(screen.getByText(/Base game/i)).toBeInTheDocument()
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalled()
  })
})
