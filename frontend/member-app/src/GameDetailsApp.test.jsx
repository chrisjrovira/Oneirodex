import { render, screen } from '@testing-library/react'
import { GameDetailsApp } from './GameDetailsApp'

test('renders action bar and freshness meta on details island', () => {
  render(
    <GameDetailsApp
      gameUuid="abc-123"
      gameName="Celeste"
      lifecycleState="update_available"
      clientConnected={false}
      freshnessStatus="behind"
      sizeLabel="1.2 GB"
      hltbMain={8}
    />,
  )
  expect(screen.getByRole('link', { name: /^Download$/i })).toHaveAttribute(
    'href',
    '/download_game/abc-123',
  )
  expect(screen.getByText(/Freshness:\s*behind/i)).toBeInTheDocument()
  expect(screen.getByText(/HLTB:/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Install$/i })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
})
