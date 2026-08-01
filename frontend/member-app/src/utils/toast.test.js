import { afterEach, beforeEach, vi } from 'vitest'
import { showToast } from './toast'

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

test('showToast auto-dismisses after a few seconds', () => {
  showToast('Queued', 'info')
  expect(document.getElementById('gt-toast-host')).toBeTruthy()
  vi.advanceTimersByTime(3200)
  expect(document.querySelector('.gt-toast--out')).toBeTruthy()
  vi.advanceTimersByTime(220)
  expect(document.getElementById('gt-toast-host')).toBeNull()
})
