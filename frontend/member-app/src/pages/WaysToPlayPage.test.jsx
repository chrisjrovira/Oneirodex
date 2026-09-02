import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { WaysToPlayPage } from './WaysToPlayPage'

function renderPage(shellConfig = {}) {
  return render(
    <MemoryRouter>
      <WaysToPlayPage shellConfig={shellConfig} />
    </MemoryRouter>,
  )
}

test('links catalog play paths and Systems', () => {
  renderPage()

  expect(screen.getByRole('link', { name: /^Browser/ })).toHaveAttribute(
    'href',
    '/library?play_mode=browser',
  )
  expect(screen.getByRole('link', { name: /^Companion/ })).toHaveAttribute(
    'href',
    '/library?play_mode=companion',
  )
  expect(screen.getByRole('link', { name: /^Catalog/ })).toHaveAttribute(
    'href',
    '/library?play_mode=catalog',
  )
  expect(screen.getByRole('link', { name: /^Systems/ })).toHaveAttribute('href', '/systems')
  expect(screen.queryByRole('link', { name: /^VR/ })).not.toBeInTheDocument()
})

test('shows VR when the flag is on', () => {
  renderPage({ enableVr: true })
  expect(screen.getByRole('link', { name: /VR/ })).toHaveAttribute('href', '/vr')
})

test('cards are stacked tiles, not bar buttons', () => {
  // `.od-btn` forces nowrap + centered inline-flex, which smashed title and
  // body onto one line. These links must stay readable multi-line cards.
  const { container } = renderPage()
  const cards = container.querySelectorAll('.od-ways-to-play__card')
  expect(cards.length).toBeGreaterThanOrEqual(4)
  for (const card of cards) {
    expect(card.classList.contains('od-btn')).toBe(false)
    expect(card.querySelector('.od-ways-to-play__card-title')).toBeTruthy()
    expect(card.querySelector('.od-ways-to-play__card-body')).toBeTruthy()
  }
})
