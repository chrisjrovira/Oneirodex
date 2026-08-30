import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { GameCard } from './GameCard'
import { HOVER_TRAILER_MS } from './TileHoverTrailer'

/** The blocked-Play panel links out (Help, Report), so those cases need a
 *  router. The rest of the file renders bare on purpose — a badge does not. */
function renderRouted(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

/** `data-corner` lives on the per-corner stack inside the badge-layers wrapper. */
function badgeCorner(corner) {
  return screen.getByLabelText(/game badges/i).querySelector(`[data-corner="${corner}"]`)
}

const baseGame = {
  uuid: '11111111-1111-4111-8111-111111111111',
  name: 'Archery Kings VR',
  cover_url: '/static/library/images/cover.jpg',
  is_favorite: false,
  user_status: null,
  has_local_override: true,
  is_vr: true,
  genres: ['Sports'],
}

const originalMatchMedia = window.matchMedia

afterEach(() => {
  vi.useRealTimers()
  if (typeof originalMatchMedia === 'function') {
    window.matchMedia = originalMatchMedia
  } else {
    Reflect.deleteProperty(window, 'matchMedia')
  }
})

test('renders L and VR badges via BadgeStack when flags set', () => {
  render(<GameCard game={baseGame} showPlayStatus={false} isAdmin={false} />)
  expect(screen.getByTitle(/local metadata/i)).toHaveTextContent('L')
  expect(screen.getByTitle(/virtual reality/i)).toHaveTextContent('VR')
  const stack = badgeCorner('top-left')
  expect(stack).toHaveAttribute('data-corner', 'top-left')
  expect(stack).toHaveAttribute('data-vr-in-stack', 'top-left')
})

test('places hamburger and favorite together in the top-right stack', () => {
  render(<GameCard game={baseGame} showPlayStatus={false} isAdmin={false} />)
  expect(screen.getByRole('button', { name: /open actions for archery kings vr/i })).toHaveAttribute(
    'data-chrome-anchor',
    'top-right',
  )
  // Favorite now sits directly under the hamburger (same top-right corner).
  expect(screen.getByRole('button', { name: /add archery kings vr to favorites/i })).toHaveAttribute(
    'data-chrome-anchor',
    'top-right',
  )
})

test('play status joins the top-right chrome stack; NEW stays top-left', () => {
  // Relative to now — a hardcoded date silently ages out of the 14-day NEW window.
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  render(
    <GameCard
      game={{
        ...baseGame,
        date_identified: twoDaysAgo,
        library_platform: 'PCWIN',
        library_platform_label: 'PC Windows',
      }}
      showPlayStatus
      isAdmin={false}
    />,
  )
  expect(screen.getByRole('button', { name: /game status:/i })).toHaveAttribute(
    'data-chrome-anchor',
    'top-right',
  )
  expect(badgeCorner('top-left')).toHaveAttribute('data-corner', 'top-left')
  expect(screen.getByTitle(/newly added/i)).toHaveTextContent('NEW')
  const chip = screen.getByTitle('PC Windows')
  expect(chip).toHaveTextContent('PC')
  expect(chip).not.toHaveTextContent('PC Windows')
})

test('omits BadgeStack when no signals', () => {
  render(
    <GameCard
      game={{ ...baseGame, has_local_override: false, is_vr: false }}
      showPlayStatus={false}
      isAdmin={false}
    />,
  )
  expect(screen.queryByLabelText(/game badges/i)).toBeNull()
})

test('renders MISSING badge when path_status is missing', () => {
  render(
    <GameCard
      game={{
        ...baseGame,
        has_local_override: false,
        is_vr: false,
        path_status: 'missing',
      }}
      showPlayStatus={false}
      isAdmin={false}
    />,
  )
  const badge = screen.getByTitle(/removed from disk/i)
  expect(badge).toHaveTextContent('MISSING')
  expect(badge).toHaveAttribute('data-badge', 'MISSING')
  expect(badgeCorner('top-left')).toHaveAttribute('data-corner', 'top-left')
})

test('renders MISSING badge when path_missing is true', () => {
  render(
    <GameCard
      game={{
        ...baseGame,
        has_local_override: false,
        is_vr: false,
        path_missing: true,
      }}
      showPlayStatus={false}
      isAdmin={false}
    />,
  )
  expect(screen.getByTitle(/no longer on disk/i)).toHaveTextContent('MISSING')
})

// A blocked Play is a *button*, not a dead span.
//
// It used to be a <span aria-disabled> whose only explanation lived in a native
// `title`: never shown on a touch screen, unreachable by keyboard, and gone the
// moment the pointer moved. Play is precisely the control someone presses when
// they do not know why a title will not run, so these assert that it can
// answer — not merely that it looks unavailable.
test('a blocked Play explains itself on press: unsupported archive', async () => {
  const user = userEvent.setup()
  renderRouted(
    <GameCard
      game={{
        ...baseGame,
        play_url: null,
        play_blocker: 'unsupported_archive',
        companion_hint: 'Cannot extract .tar.gz for browser play.',
      }}
      showPlayStatus={false}
      isAdmin={false}
    />,
  )
  const play = screen.getByLabelText(/browser play unavailable — unsupported archive/i)
  expect(play.tagName).toBe('BUTTON')
  expect(play).toHaveClass('gt-tile-play--disabled')
  expect(play).toHaveAttribute('aria-expanded', 'false')

  await user.click(play)
  const panel = screen.getByRole('dialog', { name: /cannot be played in the browser/i })
  expect(panel).toHaveTextContent('Cannot extract .tar.gz for browser play.')
  expect(screen.getByRole('link', { name: /browser play requirements/i })).toBeTruthy()
  expect(screen.getByRole('link', { name: /report an issue/i })).toBeTruthy()
  // Not an admin, so the firmware page is not offered.
  expect(screen.queryByRole('link', { name: /emulator profiles/i })).toBeNull()
})

test('a blocked Play explains itself on press: missing firmware', async () => {
  const user = userEvent.setup()
  renderRouted(
    <GameCard
      game={{
        ...baseGame,
        play_url: '/static/vendor/webretro/webretro.html?guid=111&core=yabause',
        can_play_in_browser: true,
        bios_required: true,
        firmware_missing: true,
        bios: {
          message: 'yabause needs BIOS under Admin → emulator BIOS (missing: saturn_bios.bin)',
          hint: 'Upload legally obtained firmware via Admin → emulator BIOS',
        },
      }}
      showPlayStatus={false}
      isAdmin={false}
    />,
  )
  const play = screen.getByLabelText(/browser play unavailable — firmware missing/i)
  expect(play.tagName).toBe('BUTTON')
  expect(play).toHaveClass('gt-tile-play--disabled')
  // The blocker outranks a play_url that is present but unusable: no live link.
  expect(screen.queryByRole('link', { name: /^play/i })).toBeNull()

  await user.click(play)
  expect(
    screen.getByRole('dialog', { name: /cannot be played in the browser/i }),
  ).toHaveTextContent('yabause needs BIOS under Admin → emulator BIOS (missing: saturn_bios.bin)')
})

test('an admin also gets the route that fixes it', async () => {
  const user = userEvent.setup()
  renderRouted(
    <GameCard
      game={{ ...baseGame, firmware_missing: true, bios: { message: 'needs BIOS' } }}
      showPlayStatus={false}
      isAdmin
    />,
  )
  await user.click(screen.getByLabelText(/browser play unavailable — firmware missing/i))
  // The member is told what is wrong; the admin is told where to go and fix it.
  expect(screen.getByRole('link', { name: /emulator profiles/i })).toHaveAttribute(
    'href',
    '/admin/emulator_profiles',
  )
})

test('a title with no art gets a drawn, themed fallback rather than the old JPG', () => {
  // default_cover.jpg baked the mark and the words into one raster: unreadable
  // below roughly a 220px tile, and green whatever theme was selected. A row
  // that carries that path is a row with no art, not a row with art.
  render(<GameCard game={{ ...baseGame, cover_url: '' }} showPlayStatus={false} isAdmin={false} />)

  const fallback = document.querySelector('[data-cover-fallback]')
  expect(fallback).not.toBeNull()
  expect(fallback.textContent).toContain(baseGame.name)
  expect(document.querySelector('img.game-cover')).toBeNull()
})

test('the stored placeholder path counts as no art, not as art', () => {
  render(
    <GameCard
      game={{ ...baseGame, cover_url: '/static/newstyle/default_cover.jpg' }}
      showPlayStatus={false}
      isAdmin={false}
    />,
  )

  expect(document.querySelector('[data-cover-fallback]')).not.toBeNull()
  expect(document.querySelector('img.game-cover')).toBeNull()
})

test('rows layout captions the title beside the cover', () => {
  render(
    <GameCard
      game={{
        ...baseGame,
        first_release_date: '1998-11-21',
        library_platform_label: 'Nintendo 64',
      }}
      layout="rows"
      showPlayStatus={false}
      isAdmin={false}
    />,
  )
  const meta = document.querySelector('.game-card__row-meta')
  expect(meta).toHaveTextContent('Archery Kings VR')
  expect(meta).toHaveTextContent('Nintendo 64')
  expect(meta).toHaveTextContent('1998')
})

const TRAILER_EMBED = 'https://www.youtube.com/embed/abc123DEF'

function stubMatchMedia(reduced) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: reduced && String(query).includes('prefers-reduced-motion: reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

test('a missing trailer URL keeps the cover only', () => {
  vi.useFakeTimers()
  stubMatchMedia(false)
  const { container } = render(
    <GameCard game={baseGame} showPlayStatus={false} isAdmin={false} />,
  )
  fireEvent.pointerEnter(container.querySelector('.game-card-container'))
  act(() => {
    vi.advanceTimersByTime(HOVER_TRAILER_MS + 20)
  })
  expect(container.querySelector('.gt-tile-hover-trailer')).toBeNull()
  expect(container.querySelector('img.game-cover')).not.toBeNull()
  vi.useRealTimers()
})

test('hover with a trailer URL mounts a muted iframe over the cover', () => {
  vi.useFakeTimers()
  stubMatchMedia(false)
  const { container } = render(
    <GameCard
      game={{ ...baseGame, trailer_embed_url: TRAILER_EMBED }}
      showPlayStatus={false}
      isAdmin={false}
    />,
  )
  fireEvent.pointerEnter(container.querySelector('.game-card-container'))
  expect(container.querySelector('.gt-tile-hover-trailer')).toBeNull()
  act(() => {
    vi.advanceTimersByTime(HOVER_TRAILER_MS)
  })
  const iframe = container.querySelector('iframe.gt-tile-hover-trailer')
  expect(iframe).not.toBeNull()
  expect(iframe.getAttribute('src')).toContain('mute=1')
  expect(iframe.getAttribute('src')).toContain('autoplay=1')
  expect(iframe).toHaveAttribute('aria-hidden', 'true')
  expect(container.querySelector('img.game-cover')).not.toBeNull()
  fireEvent.pointerLeave(container.querySelector('.game-card-container'))
  expect(container.querySelector('.gt-tile-hover-trailer')).toBeNull()
  vi.useRealTimers()
})

test('reduced-motion does not autoplay a hover trailer', () => {
  vi.useFakeTimers()
  stubMatchMedia(true)
  const { container } = render(
    <GameCard
      game={{ ...baseGame, trailer_embed_url: TRAILER_EMBED }}
      showPlayStatus={false}
      isAdmin={false}
    />,
  )
  fireEvent.pointerEnter(container.querySelector('.game-card-container'))
  act(() => {
    vi.advanceTimersByTime(HOVER_TRAILER_MS + 20)
  })
  expect(container.querySelector('.gt-tile-hover-trailer')).toBeNull()
  expect(container.querySelector('img.game-cover')).not.toBeNull()
  vi.useRealTimers()
})
