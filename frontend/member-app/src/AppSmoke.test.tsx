import { render, screen } from '@testing-library/react'
import { AppSmoke } from './AppSmoke'

test('renders library grid smoke marker', () => {
  render(<AppSmoke />)
  expect(screen.getByText('library-grid-ok')).toBeInTheDocument()
})
