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

test('can be dismissed before the timer runs out', () => {
  showToast('Scan failed', 'error')
  const close = document.querySelector('.gt-toast__close')
  expect(close).toBeTruthy()

  close.click()
  vi.advanceTimersByTime(220)
  expect(document.getElementById('gt-toast-host')).toBeNull()
})

test('message text is never parsed as markup', () => {
  showToast('<img src=x onerror=alert(1)>', 'info')
  const text = document.querySelector('.gt-toast__text')
  expect(text.querySelector('img')).toBeNull()
  expect(text.textContent).toContain('<img')
})

test('a sixth success toast collapses the stack to a count', () => {
  for (const label of ['One', 'Two', 'Three', 'Four', 'Five', 'Six']) {
    showToast(label, 'success')
  }
  const toasts = document.querySelectorAll('.gt-toast')
  expect(toasts).toHaveLength(1)
  expect(toasts[0].textContent).toContain('6 notifications')
})
