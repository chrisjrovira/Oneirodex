/**
 * Copy raw text to the clipboard without stripping or transforming it.
 * Tries Clipboard API first; on failure (common over plain HTTP LAN) falls back to
 * selecting an optional DOM element, then a temporary textarea + execCommand('copy').
 */

/** Options for {@link copyText}. */
export interface CopyTextOptions {
  /** An already-rendered element to select and copy from before the textarea path. */
  selectEl?: Element | null
}

/**
 * @param text the exact string to place on the clipboard
 * @param options optional element to select as the second fallback
 * @returns true when a copy path reported success
 */
export async function copyText(text: string, options: CopyTextOptions = {}): Promise<boolean> {
  if (typeof text !== 'string' || text.length === 0) {
    return false
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Insecure context / permission denied — try legacy fallbacks.
    }
  }

  const selectEl = options.selectEl
  if (selectEl) {
    try {
      if (copyViaElementSelection(selectEl)) {
        return true
      }
    } catch {
      // fall through to textarea
    }
  }

  return copyViaTextarea(text)
}

/** Select an element's contents and `execCommand('copy')` it. */
export function copyViaElementSelection(el: Element | null): boolean {
  if (typeof document === 'undefined' || !el) {
    return false
  }

  const selection = window.getSelection?.()
  if (!selection) {
    return false
  }

  const range = document.createRange()
  range.selectNodeContents(el)
  selection.removeAllRanges()
  selection.addRange(range)
  let ok = false
  try {
    if (typeof document.execCommand === 'function') {
      ok = document.execCommand('copy')
    }
  } finally {
    // Leave selection so the user can Ctrl+C if execCommand failed.
    if (ok) {
      selection.removeAllRanges()
    }
  }
  return Boolean(ok)
}

/** Copy `text` via a throwaway offscreen `<textarea>` + `execCommand('copy')`. */
export function copyViaTextarea(text: string): boolean {
  if (typeof document === 'undefined') {
    return false
  }

  const input = document.createElement('textarea')
  input.value = text
  input.setAttribute('readonly', '')
  input.setAttribute('aria-hidden', 'true')
  input.style.position = 'fixed'
  input.style.top = '0'
  input.style.left = '0'
  input.style.width = '1px'
  input.style.height = '1px'
  input.style.padding = '0'
  input.style.border = 'none'
  input.style.outline = 'none'
  input.style.boxShadow = 'none'
  input.style.background = 'transparent'
  input.style.opacity = '0'
  document.body.appendChild(input)

  let ok = false
  try {
    input.focus()
    input.select()
    input.setSelectionRange(0, text.length)
    if (typeof document.execCommand === 'function') {
      ok = document.execCommand('copy')
    }
  } catch {
    ok = false
  } finally {
    document.body.removeChild(input)
  }
  return Boolean(ok)
}
