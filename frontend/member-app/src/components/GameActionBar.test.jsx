import { render, screen } from '@testing-library/react'
import { GameActionBar } from './GameActionBar'

test('Download is always available; Install gated without client', () => {
  render(
    <GameActionBar gameUuid="abc" gameName="Demo" lifecycleState="not_downloaded" />,
  )
  expect(screen.getByRole('link', { name: /^Download$/i })).toHaveAttribute(
    'href',
    '/download_game/abc',
  )
  expect(screen.getByRole('button', { name: /^Install$/i })).toBeDisabled()
  expect(screen.getByRole('button', { name: /^Uninstall$/i })).toBeDisabled()
})

test('Install enabled when companion client connected', () => {
  render(
    <GameActionBar
      gameUuid="abc"
      gameName="Demo"
      clientConnected
      lifecycleState="downloaded"
    />,
  )
  expect(screen.getByRole('button', { name: /^Install$/i })).not.toBeDisabled()
})
