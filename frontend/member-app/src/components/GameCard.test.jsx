import { render, screen } from '@testing-library/react'
import { GameCard } from './GameCard'

const baseGame = {
  uuid: '11111111-1111-4111-8111-111111111111',
  name: 'Archery Kings VR',
  cover_url: '/static/newstyle/default_cover.jpg',
  is_favorite: false,
  user_status: null,
  has_local_override: true,
  is_vr: true,
  genres: ['Sports'],
}

test('renders L and VR badges via BadgeStack when flags set', () => {
  render(<GameCard game={baseGame} showPlayStatus={false} isAdmin={false} />)
  expect(screen.getByTitle(/local metadata/i)).toHaveTextContent('L')
  expect(screen.getByTitle(/virtual reality/i)).toHaveTextContent('VR')
  const stack = screen.getByLabelText(/game badges/i)
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
  render(
    <GameCard
      game={{
        ...baseGame,
        date_identified: '2026-07-20T00:00:00Z',
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
  const stack = screen.getByLabelText(/game badges/i)
  expect(stack).toHaveAttribute('data-corner', 'top-left')
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
  expect(screen.getByLabelText(/game badges/i)).toHaveAttribute('data-corner', 'top-left')
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

test('shows disabled Play when play_blocker is unsupported_archive', () => {
  render(
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
  expect(play.tagName).toBe('SPAN')
  expect(play).toHaveAttribute('aria-disabled', 'true')
  expect(play).toHaveAttribute('title', 'Cannot extract .tar.gz for browser play.')
  expect(play).toHaveClass('gt-tile-play--disabled')
})

test('shows disabled Play when firmware_missing even if play_url is set', () => {
  render(
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
  expect(play.tagName).toBe('SPAN')
  expect(play).toHaveAttribute('aria-disabled', 'true')
  expect(play).toHaveAttribute(
    'title',
    'yabause needs BIOS under Admin → emulator BIOS (missing: saturn_bios.bin)',
  )
  expect(play).toHaveClass('gt-tile-play--disabled')
  expect(screen.queryByRole('link', { name: /play/i })).toBeNull()
})