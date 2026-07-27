import { render, screen } from '@testing-library/react'
import { PageStatus } from './PageStatus'

test('loading state sets aria-busy and shows loading message', () => {
  render(<PageStatus loading loadingMessage="Loading Discover…" />)
  const status = screen.getByRole('status')
  expect(status).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByText('Loading Discover…')).toBeInTheDocument()
})

test('emptyMessage renders polite empty status', () => {
  render(<PageStatus emptyMessage="No channels yet." />)
  expect(screen.getByRole('status')).not.toHaveAttribute('aria-busy', 'true')
  expect(screen.getByText('No channels yet.')).toBeInTheDocument()
})

test('idle with children passes through', () => {
  render(
    <PageStatus>
      <p>Ready content</p>
    </PageStatus>,
  )
  expect(screen.getByText('Ready content')).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
