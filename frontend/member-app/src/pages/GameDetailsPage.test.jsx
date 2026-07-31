import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  screenshots: ['/static/shot1.jpg', '/static/shot2.jpg'],
  urls: [{ type: 'youtube', url: 'https://www.youtube.com/watch?v=abc123DEF' }],
  video_urls: ['https://www.youtube.com/embed/abc123DEF'],
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
            versions: [
              { kind: 'base', id: 1, uuid: detailsPayload.uuid, label: 'Base game', is_default: true },
              { kind: 'extra', id: 2, uuid: 'extra-1', label: 'Extra: artbook', extra_kind: 'manual' },
            ],
          }),
      })
    }
    if (String(url).includes('/cheats')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ game_uuid: detailsPayload.uuid, cheats: [] }),
      })
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
  })
})

function renderDetails(uuid = detailsPayload.uuid) {
  return render(
    <MemoryRouter initialEntries={[`/game_details/${uuid}`]}>
      <Routes>
        <Route path="/game_details/:gameUuid" element={<GameDetailsPage />} />
        <Route path="/library" element={<div>Library</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

test('loads game details into SPA page with action bar', async () => {
  renderDetails()

  expect(await screen.findByRole('heading', { name: 'Celeste' })).toBeInTheDocument()
  expect(screen.getByText('Climb the mountain.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Install$/i })).toBeInTheDocument()
  expect(screen.getByText(/Base game/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Admin actions' })).toBeNull()
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalled()
  })
})

test('admin ⋮ menu exposes Edit Details / Edit Images', async () => {
  const user = userEvent.setup()
  global.fetch = vi.fn((url) => {
    if (String(url).includes('/details')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...detailsPayload,
            is_admin: true,
            full_disk_path: '/games/Celeste',
            server_path: '/mnt/user/games/Celeste',
          }),
      })
    }
    if (String(url).includes('/versions')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ versions: [] }),
      })
    }
    if (String(url).includes('/cheats')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ game_uuid: detailsPayload.uuid, cheats: [] }),
      })
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
  })

  renderDetails()

  expect(await screen.findByRole('heading', { name: 'Celeste' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Admin actions' }))
  expect(screen.getByRole('menuitem', { name: 'Edit Details' })).toHaveAttribute(
    'href',
    `/game_edit/${detailsPayload.uuid}`,
  )
  expect(screen.getByRole('menuitem', { name: 'Edit Images' })).toHaveAttribute(
    'href',
    `/edit_game_images/${detailsPayload.uuid}`,
  )
  expect(screen.getByText('/games/Celeste')).toBeInTheDocument()
  expect(screen.getByText('/mnt/user/games/Celeste')).toBeInTheDocument()
  expect(screen.getByLabelText('Admin paths')).toBeInTheDocument()
})

test('renders trailers, extras, and screenshot fullscreen affordances', async () => {
  const user = userEvent.setup()
  renderDetails()

  expect(await screen.findByRole('heading', { name: 'Trailers & videos' })).toBeInTheDocument()
  expect(screen.getByTitle('Game trailer 1')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Extras & DLC' })).toBeInTheDocument()
  expect(screen.getByText(/Extra: artbook/i)).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Open screenshot 1' }))
  expect(screen.getByRole('heading', { name: /Screenshot 1/i })).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Fullscreen' }).length).toBeGreaterThanOrEqual(1)
})

test('prefers trailers[].embed_url and shows extras from details payload', async () => {
  global.fetch = vi.fn((url) => {
    if (String(url).includes('/details')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...detailsPayload,
            video_urls: [],
            urls: [],
            has_trailers: true,
            trailers: [
              {
                url: 'https://www.youtube.com/watch?v=abc123DEF',
                embed_url: 'https://www.youtube.com/embed/abc123DEF',
                provider: 'youtube',
              },
            ],
            extras: [
              {
                uuid: 'extra-payload',
                name: 'Artbook PDF',
                type: 'manual',
                extra_kind: 'manual',
                on_server: true,
                download_url: '/download_other/extra/11111111-1111-4111-8111-111111111111/extra-payload',
              },
            ],
          }),
      })
    }
    if (String(url).includes('/versions')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ versions: [] }),
      })
    }
    if (String(url).includes('/cheats')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ game_uuid: detailsPayload.uuid, cheats: [] }),
      })
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
  })

  renderDetails()

  expect(await screen.findByTitle('Game trailer 1')).toHaveAttribute(
    'src',
    'https://www.youtube.com/embed/abc123DEF',
  )
  expect(screen.getByText('Artbook PDF')).toBeInTheDocument()
  expect(screen.getByText(/On server/i)).toBeInTheDocument()
  expect(screen.queryByText(/Backend extras/i)).toBeNull()
})

test('shows youtube_demo_url when no trailers exist', async () => {
  global.fetch = vi.fn((url) => {
    if (String(url).includes('/details')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...detailsPayload,
            video_urls: [],
            urls: [],
            trailers: [],
            has_trailers: false,
            youtube_demo_url: 'https://youtu.be/demoOnly99',
          }),
      })
    }
    if (String(url).includes('/versions')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ versions: [] }),
      })
    }
    if (String(url).includes('/cheats')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ game_uuid: detailsPayload.uuid, cheats: [] }),
      })
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
  })

  renderDetails()

  expect(await screen.findByRole('link', { name: 'YouTube demo' })).toHaveAttribute(
    'href',
    'https://youtu.be/demoOnly99',
  )
  expect(screen.queryByTitle('Game trailer 1')).toBeNull()
})

test('versions: default chip + Download when downloadable; Missing on disk hides Download', async () => {
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
            versions: [
              {
                kind: 'base',
                id: 1,
                uuid: detailsPayload.uuid,
                label: 'Base game',
                is_default: true,
                downloadable: true,
                size: '1.2 GB',
              },
              {
                kind: 'update',
                id: 2,
                uuid: 'update-missing',
                label: 'Update: gone.bin',
                is_default: false,
                path_missing: true,
                downloadable: false,
                size: null,
              },
            ],
          }),
      })
    }
    if (String(url).includes('/cheats')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ game_uuid: detailsPayload.uuid, cheats: [] }),
      })
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
  })

  renderDetails()

  expect(await screen.findByRole('heading', { name: 'Versions' })).toBeInTheDocument()
  expect(screen.getByText('Default')).toBeInTheDocument()
  const versionsSection = document.getElementById('updates')
  expect(versionsSection).toBeTruthy()
  expect(versionsSection).toHaveTextContent('1.2 GB')
  const downloadLinks = within(versionsSection).getAllByRole('link', { name: 'Download' })
  expect(downloadLinks).toHaveLength(1)
  expect(downloadLinks[0]).toHaveAttribute('href', `/download_game/${detailsPayload.uuid}`)
  expect(within(versionsSection).getByText(/Missing on disk/i)).toBeInTheDocument()
  expect(within(versionsSection).getByText(/Update: gone\.bin/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Remove missing versions/i })).toBeNull()
})

test('admin can remove missing versions via cleanup_orphans', async () => {
  const user = userEvent.setup()
  global.fetch = vi.fn((url, options = {}) => {
    const href = String(url)
    if (href.includes('/details')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...detailsPayload,
            is_admin: true,
          }),
      })
    }
    if (href.includes('/versions/cleanup_orphans')) {
      expect(options.method).toBe('POST')
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ removed: 1, message: 'Removed 1 missing version' }),
      })
    }
    if (href.includes('/versions')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            versions: [
              {
                kind: 'base',
                id: 1,
                uuid: detailsPayload.uuid,
                label: 'Base game',
                is_default: true,
                downloadable: true,
              },
              {
                kind: 'update',
                id: 2,
                uuid: 'update-missing',
                label: 'Update: orphan.bin',
                path_missing: true,
                downloadable: false,
              },
            ],
          }),
      })
    }
    if (href.includes('/cheats')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ game_uuid: detailsPayload.uuid, cheats: [] }),
      })
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
  })

  renderDetails()

  expect(await screen.findByRole('button', { name: /Remove missing versions/i })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Remove missing versions/i }))
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/versions/cleanup_orphans'),
      expect.objectContaining({ method: 'POST' }),
    )
  })
  const versionsSection = document.getElementById('updates')
  expect(within(versionsSection).getByRole('status')).toHaveTextContent(/Removed 1 missing version/i)
})
