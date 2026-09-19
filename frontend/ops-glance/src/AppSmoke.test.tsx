import { render, screen } from '@testing-library/react'
import { AppSmoke } from './AppSmoke'

test('renders ops glance smoke marker', () => {
  render(<AppSmoke />)
  expect(screen.getByText('ops-glance-ok')).toBeInTheDocument()
})
