import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import { GamePreviewPopup } from './GamePreviewPopup'

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
  const { container } = renderPopup({ onClose })
  fireEvent.click(container.querySelector('.gt-preview__scrim'))
  expect(onClose).toHaveBeenCalled()
})

test('renders nothing without a game', () => {
  const { container } = render(
    <MemoryRouter>
      <GamePreviewPopup game={null} onClose={() => {}} />
    </MemoryRouter>,
  )
  expect(container).toBeEmptyDOMElement()
})
