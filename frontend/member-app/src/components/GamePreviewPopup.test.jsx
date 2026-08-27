import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import { fetchGameEditions } from '../api/gameEditions'
import {
  editionBlockerText,
  GamePreviewPopup,
  formatAdded,
  formatReleased,
  previewBadges,
  systemCountLabel,
} from './GamePreviewPopup'

// The systems section is a second request. Every test here would otherwise hit
// the network, and an unmocked rejection lands as a state update after the test
// has finished — which fails the *next* test rather than this one.
vi.mock('../api/gameEditions', () => ({
  fetchGameEditions: vi.fn(() => Promise.resolve({ editions: [] })),
}))

const SNES_EDITION = {
  uuid: 'abc-123',
  name: 'Portal 2',
  is_current: true,
  library_name: 'PC Games',
  library_platform: 'PCWIN',
  library_platform_label: 'PC Windows',
  can_play_in_browser: false,
  play_blocker: 'companion_or_catalog',
  companion_hint: 'Plays through the desktop companion',
  launchers: [],
}

const GBA_EDITION = {
  uuid: 'def-456',
  name: 'Portal 2',
  is_current: false,
  library_name: 'Handhelds',
  library_platform: 'GBA',
  library_platform_label: 'Game Boy Advance',
  can_play_in_browser: true,
  launchers: [
    { core: 'mgba', label: 'mgba', is_default: true, play_url: '/play?core=mgba' },
    { core: 'vba_next', label: 'vba_next', is_default: false, play_url: '/play?core=vba_next' },
  ],
}

beforeEach(() => {
  fetchGameEditions.mockReset()
  fetchGameEditions.mockResolvedValue({ editions: [] })
})

const GAME = {
  uuid: 'abc-123',
  name: 'Portal 2',
  summary: 'A first-person puzzle game.',
  cover_url: '/static/library/images/p2.jpg',
  platform_label: 'PC Windows',
  size: '8.2 GB',
  genres: ['Puzzle', 'Adventure'],
  rating: 95.4,
}

function renderPopup(props = {}) {
  return render(
    <MemoryRouter>
      <GamePreviewPopup game={GAME} onClose={() => {}} {...props} />
    </MemoryRouter>,
  )
}

test('shows the shortened detail a member scans before opening the page', () => {
  renderPopup()
  expect(screen.getByRole('dialog', { name: /Preview of Portal 2/i })).toBeInTheDocument()
  expect(screen.getByText('Portal 2')).toBeInTheDocument()
  expect(screen.getByText('A first-person puzzle game.')).toBeInTheDocument()
  expect(screen.getByText('PC Windows')).toBeInTheDocument()
  expect(screen.getByText('8.2 GB')).toBeInTheDocument()
  expect(screen.getByText(/Puzzle · Adventure/)).toBeInTheDocument()
})

test('surfaces the state that changes what you can do with the title', () => {
  renderPopup({
    game: {
      ...GAME,
      path_missing: true,
      has_updates: true,
      updates_count: 3,
      owned: true,
      is_vr: true,
      is_multi_disc: true,
      disc_count: 2,
      date_identified: '2026-02-10T12:00:00Z',
    },
  })

  expect(screen.getByText('Files missing on disk')).toBeInTheDocument()
  expect(screen.getByText('3 updates')).toBeInTheDocument()
  expect(screen.getByText('Owned')).toBeInTheDocument()
  expect(screen.getByText('VR')).toBeInTheDocument()
  expect(screen.getByText('2 discs')).toBeInTheDocument()
  expect(screen.getByText(/Added/)).toBeInTheDocument()
})

test('a title with nothing notable about it gets no badges', () => {
  expect(previewBadges(GAME)).toEqual([])
})

test('browser-playable and catalog-only are distinct, not both "no"', () => {
  expect(previewBadges({ can_play_in_browser: true }).map((b) => b.id)).toContain('play')
  expect(previewBadges({ play_blocker: 'catalog_only' }).map((b) => b.id)).toContain('catalog')
})

test('a missing-files title is warned about, not decorated', () => {
  const [first] = previewBadges({ path_missing: true, owned: true })
  expect(first.tone).toBe('warn')
})

test('formatAdded ignores values it cannot read rather than printing junk', () => {
  expect(formatAdded(null)).toBeNull()
  expect(formatAdded('not-a-date')).toBeNull()
})

// The release fact was absent from every preview in the library and nobody
// noticed, because the facts row read `first_release_year` — a key browse has
// never sent — and a missing fact is filtered out silently. Assert against the
// key the payload actually carries.
test('formatReleased reads the field browse really sends', () => {
  expect(formatReleased({ first_release_date: '1997-01-31' })).toMatch(/^Released /)
  expect(formatReleased({ first_release_date: '1997-01-31' })).toMatch(/1997/)
})

test('formatReleased still accepts a bare year, and refuses junk', () => {
  expect(formatReleased({ first_release_year: 1997 })).toBe('Released 1997')
  expect(formatReleased({ first_release_date: 'not-a-date' })).toBeNull()
  expect(formatReleased({})).toBeNull()
  expect(formatReleased(null)).toBeNull()
})

test('links through to the real details route', () => {
  renderPopup()
  expect(screen.getByRole('link', { name: /Open details/i })).toHaveAttribute(
    'href',
    '/game_details/abc-123',
  )
})

test('is honest when there is no summary rather than showing a blank block', () => {
  renderPopup({ game: { ...GAME, summary: '' } })
  expect(screen.getByText(/No summary yet/i)).toBeInTheDocument()
})

// fireEvent, not userEvent: a single userEvent interaction costs ~30s on a
// network-mounted checkout, and a timeout mid-interaction leaves the component
// mounted, which then breaks the *next* test. These assertions are about
// dismiss wiring, not input realism, so the cheap path is also the honest one.
test('Escape closes it', () => {
  const onClose = vi.fn()
  renderPopup({ onClose })
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onClose).toHaveBeenCalled()
})

test('clicking the scrim closes it but clicking the panel does not', () => {
  const onClose = vi.fn()
  renderPopup({ onClose })

  // Inside the panel: must survive, or the preview dismisses while you read it.
  fireEvent.click(screen.getByText('Portal 2'))
  expect(onClose).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: /Close preview/i }))
  expect(onClose).toHaveBeenCalled()
})

test('clicking the scrim itself dismisses', () => {
  const onClose = vi.fn()
  renderPopup({ onClose })

  // Queried from the document, not from `container`: the scrim is portalled to
  // <body> so `position: fixed` is measured against the viewport rather than
  // against a transformed tile ancestor. Rendered in place it dimmed only the
  // tile's row.
  fireEvent.click(document.querySelector('.gt-preview__scrim'))
  expect(onClose).toHaveBeenCalled()
})

test('the scrim is portalled out of the card, not rendered inside it', () => {
  // The defect this guards: `position: fixed` is relative to the nearest
  // transformed/contained ancestor, and tiles have both. Left in the card the
  // overlay could never cover the page, no matter what its CSS said.
  const { container } = renderPopup({})

  expect(container.querySelector('.gt-preview__scrim')).toBeNull()
  expect(document.querySelector('.gt-preview__scrim')).not.toBeNull()
})

test('opening a second preview closes the first', () => {
  // Every GameCard owns a popup, so without a singleton rule two could be open
  // at once — two scrims, two dialogs, both claiming aria-modal.
  const firstClose = vi.fn()
  renderPopup({ onClose: firstClose })
  expect(firstClose).not.toHaveBeenCalled()

  renderPopup({ onClose: vi.fn() })

  expect(firstClose).toHaveBeenCalled()
})

test('renders nothing without a game', () => {
  const { container } = render(
    <MemoryRouter>
      <GamePreviewPopup game={null} onClose={() => {}} />
    </MemoryRouter>,
  )
  expect(container).toBeEmptyDOMElement()
})


test('lists every system the title is held on, current copy marked', async () => {
  // The grid renders one tile per library row, so two copies of a game read as
  // two unrelated games. This section is the only place they are one title.
  fetchGameEditions.mockResolvedValue({ editions: [SNES_EDITION, GBA_EDITION] })
  renderPopup()

  await waitFor(() => expect(screen.getByText('Game Boy Advance')).toBeInTheDocument())
  // Scoped to the section: "PC Windows" is also the tile's platform fact, and an
  // unscoped query matches both.
  const systems = document.querySelector('.gt-preview__systems')
  expect(within(systems).getByText('PC Windows')).toBeInTheDocument()
  expect(within(systems).getByText('This copy')).toBeInTheDocument()
  expect(within(systems).getByText('2 systems')).toBeInTheDocument()
})

test('offers a launcher per emulator core, not just the preferred one', async () => {
  fetchGameEditions.mockResolvedValue({ editions: [GBA_EDITION] })
  renderPopup()

  await waitFor(() =>
    expect(screen.getByRole('link', { name: /Play · mgba/ })).toHaveAttribute(
      'href',
      '/play?core=mgba',
    ),
  )
  expect(screen.getByRole('link', { name: /Play · vba_next/ })).toHaveAttribute(
    'href',
    '/play?core=vba_next',
  )
})

test('a copy that cannot be launched says why instead of being hidden', async () => {
  // Dropping unplayable copies would answer "which systems is this on?" with a
  // half-truth, and the reason is usually the thing to act on.
  fetchGameEditions.mockResolvedValue({ editions: [SNES_EDITION] })
  renderPopup()

  await waitFor(() =>
    expect(screen.getByText('Plays through the desktop companion')).toBeInTheDocument(),
  )
})

test('surfaces GOG, Epic, and a trailer from the editions payload, not only Steam from browse', async () => {
  // Browse never sends game.urls or video_urls per tile. The preview already
  // asks for editions once; that is where GOG / Epic / YouTube ride, so the
  // popup matches details without becoming a second player.
  fetchGameEditions.mockResolvedValue({
    editions: [SNES_EDITION],
    urls: [
      { type: 'gog', url: 'https://www.gog.com/game/portal_2' },
      { type: 'epic', url: 'https://store.epicgames.com/p/portal-2' },
      { type: 'youtube', url: 'https://www.youtube.com/watch?v=tax4e4hBBZc' },
    ],
  })
  renderPopup({
    game: {
      ...GAME,
      steam_url: 'https://store.steampowered.com/app/620',
    },
  })

  expect(screen.getByRole('link', { name: 'Steam' })).toHaveAttribute(
    'href',
    'https://store.steampowered.com/app/620',
  )
  await waitFor(() => expect(screen.getByRole('link', { name: 'GOG' })).toBeInTheDocument())
  expect(screen.getByRole('link', { name: 'Epic' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'YouTube' })).toHaveAttribute(
    'href',
    'https://www.youtube.com/watch?v=tax4e4hBBZc',
  )
})

test('a failed editions lookup keeps Steam from browse and does not invent stores', async () => {
  fetchGameEditions.mockRejectedValue(new Error('boom'))
  renderPopup({
    game: {
      ...GAME,
      steam_url: 'https://store.steampowered.com/app/620',
    },
  })

  expect(screen.getByRole('link', { name: 'Steam' })).toBeInTheDocument()
  await waitFor(() =>
    expect(screen.getByText(/Could not check which systems/i)).toBeInTheDocument(),
  )
  expect(screen.queryByRole('link', { name: 'GOG' })).toBeNull()
})

test('editionBlockerText names the blocker a member can act on', () => {
  expect(editionBlockerText({ can_play_in_browser: true })).toBeNull()
  expect(editionBlockerText({ play_blocker: 'catalog_only' })).toMatch(/Catalog/)
  expect(editionBlockerText({ play_blocker: 'no_browser_core' })).toMatch(/browser core/)
  // Firmware wins over the generic blocker: it is the specific, fixable one.
  expect(
    editionBlockerText({ firmware_missing: true, play_blocker: 'no_browser_core' }),
  ).toMatch(/firmware/i)
})


test('the systems count counts systems, not copies', () => {
  // Two copies in two PC libraries is one system. "2 systems" would send a
  // member looking for a console that is not there, and "1 systems" beside a
  // one-item list is wrong twice over.
  const pc = { library_platform: 'PCWIN' }
  expect(systemCountLabel([pc, { ...pc }])).toBeNull()
  expect(systemCountLabel([pc])).toBeNull()
  expect(systemCountLabel([])).toBeNull()
  expect(systemCountLabel([pc, { library_platform: 'GBA' }])).toBe('2 systems')
  // A row with no platform at all must not inflate the count.
  expect(systemCountLabel([pc, { library_platform: null }])).toBeNull()
})
