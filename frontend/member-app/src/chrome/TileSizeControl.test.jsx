import { fireEvent, render, screen } from '@testing-library/react'
import { TileSizeControl } from './TileSizeControl'

test('shows percent label for legacy letter value', () => {
  render(<TileSizeControl value="M" />)
  expect(screen.getByText('50%')).toBeInTheDocument()
  expect(screen.getByLabelText('Library tile size percent')).toHaveValue('50')
})

test('calls onChange with percent string', () => {
  const onChange = vi.fn()
  render(<TileSizeControl value="50" onChange={onChange} shellConfig={{ perPage: 20 }} />)
  const slider = screen.getByLabelText('Library tile size percent')
  fireEvent.change(slider, { target: { value: '72' } })
  expect(onChange).toHaveBeenCalledWith('72')
})
