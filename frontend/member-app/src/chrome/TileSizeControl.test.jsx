import { fireEvent, render, screen } from '@testing-library/react'
import { applyTileSizeCssVars, TileSizeControl } from './TileSizeControl'
import * as preferencesApi from '../api/preferences'

vi.mock('../api/preferences', async (importOriginal) => ({
  ...(await importOriginal()),
  savePreferences: vi.fn(async () => ({})),
}))

afterEach(() => {
  vi.useRealTimers()
  document.documentElement.classList.remove('is-tile-resizing')
})

test('shows percent label for legacy letter value', () => {
  render(<TileSizeControl value="M" />)
  expect(screen.getByText('50%')).toBeInTheDocument()
  expect(screen.getByLabelText('Game Catalog tile size percent')).toHaveValue('50')
})

test('calls onChange with percent string', () => {
  const onChange = vi.fn()
  render(<TileSizeControl value="50" onChange={onChange} shellConfig={{ perPage: 20 }} />)
  const slider = screen.getByLabelText('Game Catalog tile size percent')
  fireEvent.change(slider, { target: { value: '72' } })
  expect(onChange).toHaveBeenCalledWith('72')
})

test('unmounting mid-drag takes the resize class off <html>', () => {
  // The class lives on the document element, so React unmounting the control
  // does not remove it. Left behind, the library loses its tile transition for
  // the rest of the session.
  vi.useFakeTimers()
  const { unmount } = render(<TileSizeControl value="50" shellConfig={{ perPage: 20 }} />)
  fireEvent.change(screen.getByLabelText('Game Catalog tile size percent'), {
    target: { value: '72' },
  })
  expect(document.documentElement.classList.contains('is-tile-resizing')).toBe(true)

  unmount()
  expect(document.documentElement.classList.contains('is-tile-resizing')).toBe(false)
})

test('unmounting mid-drag still saves the pending tile size', () => {
  // The save is debounced, so navigating away right after moving the slider
  // used to fire it from an unmounted component — or, once the timer was
  // cleared, to lose it entirely. It should be flushed instead.
  vi.useFakeTimers()
  preferencesApi.savePreferences.mockClear()
  const { unmount } = render(<TileSizeControl value="50" shellConfig={{ perPage: 20 }} />)
  fireEvent.change(screen.getByLabelText('Game Catalog tile size percent'), {
    target: { value: '72' },
  })
  expect(preferencesApi.savePreferences).not.toHaveBeenCalled()

  unmount()
  expect(preferencesApi.savePreferences).toHaveBeenCalledTimes(1)
  expect(preferencesApi.savePreferences.mock.calls[0][0]).toMatchObject({ tile_size: '72' })

  // And nothing fires afterwards from the cleared timer.
  vi.runAllTimers()
  expect(preferencesApi.savePreferences).toHaveBeenCalledTimes(1)
})


describe('applyTileSizeCssVars and the title preference', () => {
  afterEach(() => {
    delete document.documentElement.dataset.odTileTitles
  })

  test('a size-only call leaves the title preference alone', () => {
    // The slider calls this on every drag with just a size. Defaulting to "on"
    // there put the strip back for anyone who had switched it off.
    applyTileSizeCssVars(50, false)
    expect(document.documentElement.dataset.odTileTitles).toBe('off')
    expect(document.documentElement.style.getPropertyValue('--od-tile-title-h')).toBe('0px')

    applyTileSizeCssVars(80)

    expect(document.documentElement.dataset.odTileTitles).toBe('off')
    expect(document.documentElement.style.getPropertyValue('--od-tile-title-h')).toBe('0px')
  })

  test('an explicit flag still wins', () => {
    applyTileSizeCssVars(50, false)
    applyTileSizeCssVars(50, true)

    expect(document.documentElement.dataset.odTileTitles).toBe('on')
    expect(
      parseFloat(document.documentElement.style.getPropertyValue('--od-tile-title-h')),
    ).toBeGreaterThan(0)
  })

  test('titles default on when nothing has been set yet', () => {
    applyTileSizeCssVars(50)
    expect(document.documentElement.dataset.odTileTitles).toBe('on')
  })
})
