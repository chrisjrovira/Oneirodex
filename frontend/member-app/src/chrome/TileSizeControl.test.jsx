import { fireEvent, render, screen } from '@testing-library/react'
import { TileSizeControl } from './TileSizeControl'

vi.mock('../api/preferences', () => ({
  preferencesFromShell: (_shell, partial) => partial,
  savePreferences: vi.fn(() => Promise.resolve({})),
}))

test('renders tile size slider with current size label', () => {
  render(<TileSizeControl value="M" />)
  expect(screen.getByRole('group', { name: /tile size/i })).toBeInTheDocument()
  expect(screen.getByRole('slider', { name: /tile size/i })).toHaveValue('1')
  expect(screen.getByText('M')).toBeInTheDocument()
})

test('onChange updates CSS vars and notifies parent', async () => {
  const onChange = vi.fn()
  render(<TileSizeControl value="M" onChange={onChange} shellConfig={{ perPage: 20 }} />)

  const slider = screen.getByRole('slider', { name: /tile size/i })
  fireEvent.change(slider, { target: { value: '2' } })

  expect(onChange).toHaveBeenCalledWith('L')
  expect(document.documentElement.style.getPropertyValue('--gt-tile-min')).toBe('220px')
  expect(document.documentElement.style.getPropertyValue('--gt-tile-gap')).toBe('12px')
})
