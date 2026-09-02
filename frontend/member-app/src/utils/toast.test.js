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
  expect(document.getElementById('od-toast-host')).toBeTruthy()
  vi.advanceTimersByTime(3200)
  expect(document.querySelector('.od-toast--out')).toBeTruthy()
  vi.advanceTimersByTime(220)
  expect(document.getElementById('od-toast-host')).toBeNull()
})

test('can be dismissed before the timer runs out', () => {
  showToast('Scan failed', 'error')
  const close = document.querySelector('.od-toast__close')
  expect(close).toBeTruthy()

  close.click()
  vi.advanceTimersByTime(220)
  expect(document.getElementById('od-toast-host')).toBeNull()
})

test('dismissing one toast leaves the others alone', () => {
  showToast('First', 'info')
  showToast('Second', 'info')
  expect(document.querySelectorAll('.od-toast')).toHaveLength(2)

  document.querySelectorAll('.od-toast__close')[0].click()
  vi.advanceTimersByTime(220)

  const remaining = document.querySelectorAll('.od-toast')
  expect(remaining).toHaveLength(1)
  expect(remaining[0].textContent).toContain('Second')
})

test('five info toasts stay individual', () => {
  for (const label of ['One', 'Two', 'Three', 'Four', 'Five']) {
    showToast(label, 'info')
  }
  const toasts = document.querySelectorAll('.od-toast')
  expect(toasts).toHaveLength(5)
  expect(toasts[0].textContent).toContain('One')
  expect(toasts[4].textContent).toContain('Five')
})

test('a sixth info toast collapses the stack to a count', () => {
  for (const label of ['One', 'Two', 'Three', 'Four', 'Five', 'Six']) {
    showToast(label, 'info')
  }
  const toasts = document.querySelectorAll('.od-toast')
  expect(toasts).toHaveLength(1)
  expect(toasts[0].textContent).toContain('6 notifications')
})

test('further info toasts increment the collapsed count', () => {
  for (let i = 0; i < 7; i += 1) {
    showToast(`n${i}`, 'success')
  }
  expect(document.querySelectorAll('.od-toast')).toHaveLength(1)
  expect(document.querySelector('.od-toast__text').textContent).toBe('7 notifications')
})

test('error toasts never join the info stack', () => {
  for (const label of ['One', 'Two', 'Three', 'Four', 'Five', 'Six']) {
    showToast(label, 'info')
  }
  showToast('Scan failed', 'error')
  const toasts = [...document.querySelectorAll('.od-toast')]
  expect(toasts).toHaveLength(2)
  expect(toasts.some((el) => el.textContent.includes('6 notifications'))).toBe(true)
  expect(toasts.some((el) => el.textContent.includes('Scan failed'))).toBe(true)
})

test('the returned dismiss handle closes it too', () => {
  const dismiss = showToast('Working', 'info')
  dismiss()
  vi.advanceTimersByTime(220)
  expect(document.getElementById('od-toast-host')).toBeNull()
})

test('message text is never parsed as markup', () => {
  showToast('<img src=x onerror=alert(1)>', 'info')
  const text = document.querySelector('.od-toast__text')
  expect(text.querySelector('img')).toBeNull()
  expect(text.textContent).toContain('<img')
})
