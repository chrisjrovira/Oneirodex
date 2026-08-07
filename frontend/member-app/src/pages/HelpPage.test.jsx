import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { HelpPage } from './HelpPage'

test('starts with Getting started open and other sections collapsed', () => {
  render(
    <MemoryRouter>
      <HelpPage />
    </MemoryRouter>,
  )

  expect(screen.getByRole('heading', { name: 'Help' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Getting started/i })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  expect(screen.getByRole('button', { name: /Library & signals/i })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  expect(screen.getByRole('link', { name: 'Report an issue' })).toHaveAttribute('href', '/report')
})

test('new chrome moves the fold controls into bar two and keeps all three', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <HelpPage shellConfig={{ enableNewChrome: true }} />
    </MemoryRouter>,
  )

  expect(screen.queryByRole('heading', { name: 'Help' })).toBeNull()
  // Report an issue is a link, not a button — it must survive the move as one,
  // or middle-click and open-in-new-tab quietly stop working.
  expect(screen.getByRole('link', { name: 'Report an issue' })).toHaveAttribute('href', '/report')

  await user.click(screen.getByRole('button', { name: 'Expand all' }))
  expect(screen.getByRole('button', { name: /Library & signals/i })).toHaveAttribute(
    'aria-expanded',
    'true',
  )

  await user.click(screen.getByRole('button', { name: 'Collapse all' }))
  expect(screen.getByRole('button', { name: /Getting started/i })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
})
