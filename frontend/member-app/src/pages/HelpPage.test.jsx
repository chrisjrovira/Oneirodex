import { render, screen } from '@testing-library/react'
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
