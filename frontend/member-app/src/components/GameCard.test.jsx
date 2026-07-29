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
  expect(screen.getByLabelText(/vr badge/i)).toHaveAttribute('data-vr-anchor', 'platform')
  expect(screen.getByLabelText(/game badges/i)).toHaveAttribute('data-corner', 'top-left')
})

test('places hamburger top-right and favorite bottom-right of cover', () => {
  render(<GameCard game={baseGame} showPlayStatus={false} isAdmin={false} />)
  expect(screen.getByRole('button', { name: /open actions for archery kings vr/i })).toHaveAttribute(
    'data-chrome-anchor',
    'top-right',
  )
  expect(screen.getByRole('button', { name: /add archery kings vr to favorites/i })).toHaveAttribute(
    'data-chrome-anchor',
    'bottom-right',
  )
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
  expect(screen.queryByLabelText(/vr badge/i)).toBeNull()
})
