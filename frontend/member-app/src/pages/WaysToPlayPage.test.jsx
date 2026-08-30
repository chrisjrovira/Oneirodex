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
