import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TileSizeControl } from './TileSizeControl'

vi.mock('../api/preferences', () => ({
  preferencesFromShell: (_shell, partial) => partial,
  savePreferences: vi.fn(() => Promise.resolve({})),
}))

test('renders segmented S M L XL controls', () => {
  render(<TileSizeControl value="M" />)
  expect(screen.getByRole('group', { name: /tile size/i })).toBeInTheDocument()
  for (const size of ['S', 'M', 'L', 'XL']) {
    expect(screen.getByRole('button', { name: size })).toBeInTheDocument()
  }
  expect(screen.getByRole('button', { name: 'M' })).toHaveAttribute('aria-pressed', 'true')
})

test('onChange updates CSS vars and notifies parent', async () => {
  const user = userEvent.setup()
  const onChange = vi.fn()
  render(<TileSizeControl value="M" onChange={onChange} shellConfig={{ perPage: 20 }} />)

  await user.click(screen.getByRole('button', { name: 'L' }))

  expect(onChange).toHaveBeenCalledWith('L')
  expect(document.documentElement.style.getPropertyValue('--gt-tile-min')).toBe('220px')
})