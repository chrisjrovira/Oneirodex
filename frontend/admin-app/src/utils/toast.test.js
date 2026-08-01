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

test('showToast mounts top-right host and auto-dismisses', () => {
  showToast('Saved', 'success')
  const host = document.getElementById('gt-toast-host')
  expect(host).toBeTruthy()
  expect(host.className).toContain('gt-toast-host')
  expect(host.textContent).toContain('Saved')
  expect(host.querySelector('.gt-toast--success')).toBeTruthy()

  vi.advanceTimersByTime(3200)
  expect(host.querySelector('.gt-toast--out')).toBeTruthy()
  vi.advanceTimersByTime(220)
  expect(document.getElementById('gt-toast-host')).toBeNull()
})
