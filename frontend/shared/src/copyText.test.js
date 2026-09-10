import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { copyText, copyViaElementSelection, copyViaTextarea } from './copyText'

function stubExecCommand(impl) {
  const fn = typeof impl === 'function' ? vi.fn(impl) : vi.fn().mockReturnValue(impl)
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: fn,
  })
  return fn
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  document.body.replaceChildren()
})

test('copyText uses clipboard.writeText when available', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })

  await expect(copyText('gt_abcd_secret-with_dashes')).resolves.toBe(true)
  expect(writeText).toHaveBeenCalledWith('gt_abcd_secret-with_dashes')
})

test('copyText falls back to textarea when writeText rejects', async () => {
  const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'))
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  const exec = stubExecCommand(true)

  await expect(copyText('gt_prefix_raw_token')).resolves.toBe(true)
  expect(writeText).toHaveBeenCalled()
  expect(exec).toHaveBeenCalledWith('copy')
})

test('copyText selects selectEl when Clipboard API is missing', async () => {
  vi.stubGlobal('navigator', { clipboard: undefined })
  const code = document.createElement('code')
  code.textContent = 'gt_sel_token_value'
  document.body.appendChild(code)
  const exec = stubExecCommand(true)

  await expect(copyText('gt_sel_token_value', { selectEl: code })).resolves.toBe(true)
  expect(exec).toHaveBeenCalledWith('copy')
  expect(window.getSelection()?.toString() || '').toBe('')
})

test('copyViaElementSelection leaves selection when copy fails', () => {
  const code = document.createElement('code')
  code.textContent = 'keep-selected'
  document.body.appendChild(code)
  stubExecCommand(false)

  expect(copyViaElementSelection(code)).toBe(false)
  expect(window.getSelection()?.toString()).toBe('keep-selected')
})

test('copyViaTextarea copies full raw string including dashes and underscores', () => {
  const secret = 'gt_abcd_part-one_part_two'
  stubExecCommand(() => {
    const active = document.activeElement
    expect(active).toBeInstanceOf(HTMLTextAreaElement)
    expect(/** @type {HTMLTextAreaElement} */ (active).value).toBe(secret)
    return true
  })

  expect(copyViaTextarea(secret)).toBe(true)
})

test('copyText returns false for empty string', async () => {
  await expect(copyText('')).resolves.toBe(false)
})
