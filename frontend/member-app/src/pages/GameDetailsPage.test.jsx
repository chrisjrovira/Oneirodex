import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GameDetailsPage } from './GameDetailsPage'
import { showToast } from '../utils/toast'

vi.mock('../utils/toast', () => ({
  showToast: vi.fn(),
}))

vi.mock('../api/downloads', () => ({
  initiateGameDownload: vi.fn(),
}))

import { initiateGameDownload } from '../api/downloads'

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
  showToast.mockReset()
  initiateGameDownload.mockReset()
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
  expect(screen.queryByRole('heading', { name: 'Cheats' })).toBeNull()
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalled()
  })
})

test('shows Cheats panel only when cheat_surface is retroarch', async () => {
  global.fetch = vi.fn((url) => {
    if (String(url).includes('/details')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...detailsPayload,
            library_platform: 'SNES',
            library_platform_label: 'Super Nintendo',
            cheat_surface: 'retroarch',
            can_play_in_browser: true,
            emulator_core: 'snes9x',
            emulator_cores: ['snes9x'],
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
  expect(await screen.findByRole('heading', { name: 'Cheats' })).toBeInTheDocument()
  const playLinks = screen.getAllByRole('link', { name: /Play in browser/i })
  expect(playLinks.length).toBeGreaterThanOrEqual(1)
  expect(playLinks[0]).toHaveAttribute('href', expect.stringContaining('cheat_surface=retroarch'))
})

test('admin path rows show the full library folder string', async () => {
  const fullPath = '/mnt/user/games/PCWIN/Indie Puzzle/Very Long Folder Name/Celeste'
  global.fetch = vi.fn((url) => {
    if (String(url).includes('/details')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...detailsPayload,
            is_admin: true,
            full_disk_path: fullPath,
            server_path: fullPath,
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
  expect(await screen.findByText(fullPath)).toBeInTheDocument()
  expect(screen.getByLabelText('Admin paths')).toBeInTheDocument()
  const pathValue = document.querySelector('.gt-details-page__path-value')
  expect(pathValue?.textContent).toBe(fullPath)
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

  const { container } = renderDetails()

  expect(await screen.findByRole('heading', { name: 'Celeste' })).toBeInTheDocument()
  const coverWrap = container.querySelector('.gt-details-page__cover-wrap')
  expect(coverWrap).toBeTruthy()
  const adminBtn = within(coverWrap).getByRole('button', { name: 'Admin actions' })
  expect(adminBtn).toHaveAttribute('data-chrome-anchor', 'top-right')
  expect(container.querySelector('.gt-details-page__hero-main .gt-details-page__admin-menu')).toBeNull()
  await user.click(adminBtn)
  expect(within(coverWrap).getByRole('menuitem', { name: 'Edit Details' })).toHaveAttribute(
    'href',
    `/game_edit/${detailsPayload.uuid}`,
  )
  expect(within(coverWrap).getByRole('menuitem', { name: 'Edit Images' })).toHaveAttribute(
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
  const downloadButtons = within(versionsSection).getAllByRole('button', { name: 'Download' })
  expect(downloadButtons).toHaveLength(1)
  expect(within(versionsSection).getByText(/Missing on disk/i)).toBeInTheDocument()
  expect(within(versionsSection).getByText(/Update: gone\.bin/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Remove missing versions/i })).toBeNull()
})

test('firmware_missing blocks Play and shows quiet honesty with Help link', async () => {
  global.fetch = vi.fn((url) => {
    if (String(url).includes('/details')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...detailsPayload,
            can_play_in_browser: true,
            play_url: '/static/vendor/webretro/webretro.html?guid=111&core=yabause',
            emulator_core: 'yabause',
            emulator_cores: ['yabause'],
            bios_required: true,
            firmware_missing: true,
            bios: {
              message: 'yabause needs BIOS under Admin → emulator BIOS (missing: saturn_bios.bin)',
              hint: 'Upload legally obtained firmware via Admin → emulator BIOS',
            },
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
  const play = screen.getByRole('button', { name: /Play in browser/i })
  expect(play).toBeDisabled()
  expect(play).toHaveAttribute(
    'title',
    'yabause needs BIOS under Admin → emulator BIOS (missing: saturn_bios.bin)',
  )
  expect(screen.queryByRole('link', { name: /Play in browser/i })).toBeNull()
  expect(screen.getByText(/yabause needs BIOS under Admin/i)).toBeInTheDocument()
  expect(screen.getByText(/Upload legally obtained firmware via Admin/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Help → Browser play/i })).toHaveAttribute(
    'href',
    '/help#browser-play',
  )
  expect(screen.queryByRole('link', { name: /Download BIOS/i })).toBeNull()
  expect(screen.queryByText(/Download BIOS/i)).toBeNull()
})

test('version download toasts Backend hint on 410 path_missing', async () => {
  const user = userEvent.setup()
  const err = new Error('This install path is gone')
  err.status = 410
  err.code = 'path_missing'
  err.hint = 'Use game details → Remove missing versions'
  err.data = { code: 'path_missing', hint: err.hint, error: 'Version file is missing on disk' }
  initiateGameDownload.mockRejectedValue(err)

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
  await user.click(within(document.getElementById('updates')).getByRole('button', { name: 'Download' }))
  await waitFor(() => {
    expect(initiateGameDownload).toHaveBeenCalledWith(detailsPayload.uuid, {
      kind: 'base',
      versionUuid: undefined,
    })
  })
  expect(showToast).toHaveBeenCalledWith('Use game details → Remove missing versions', 'error')
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
