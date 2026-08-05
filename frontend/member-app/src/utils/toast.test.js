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

test('can be dismissed before the timer runs out', () => {
  showToast('Scan failed', 'error')
  const close = document.querySelector('.gt-toast__close')
  expect(close).toBeTruthy()

  close.click()
  vi.advanceTimersByTime(220)
  expect(document.getElementById('gt-toast-host')).toBeNull()
})

test('dismissing one toast leaves the others alone', () => {
  showToast('First', 'info')
  showToast('Second', 'info')
  expect(document.querySelectorAll('.gt-toast')).toHaveLength(2)

  document.querySelectorAll('.gt-toast__close')[0].click()
  vi.advanceTimersByTime(220)

  const remaining = document.querySelectorAll('.gt-toast')
  expect(remaining).toHaveLength(1)
  expect(remaining[0].textContent).toContain('Second')
})

test('the returned dismiss handle closes it too', () => {
  const dismiss = showToast('Working', 'info')
  dismiss()
  vi.advanceTimersByTime(220)
  expect(document.getElementById('gt-toast-host')).toBeNull()
})

test('message text is never parsed as markup', () => {
  showToast('<img src=x onerror=alert(1)>', 'info')
  const text = document.querySelector('.gt-toast__text')
  expect(text.querySelector('img')).toBeNull()
  expect(text.textContent).toContain('<img')
})
