/**
 * The house confirm dialog — a real dialog, not `window.confirm` (UID-042).
 *
 * `window.confirm` renders the browser's own OK/Cancel. Those two buttons
 * cannot be renamed, so the consequence had to live entirely in the sentence,
 * and they cannot be styled, so a destructive action looked exactly like a
 * harmless one. They also sit outside the app: `buttonLanguage.test.js` cannot
 * see them, which is why twelve destructive actions drifted for as long as they
 * did.
 *
 * This is deliberately imperative DOM rather than a React component, following
 * `showToast`: it is summoned from components, from hooks, and from plain
 * modules, and a promise-returning call is a drop-in for the `window.confirm`
 * it replaces — every call site keeps its own control flow.
 *
 * Typed acknowledgement is NOT here. It stays where it is proportionate, on
 * the factory reset (`SystemResetPanel.jsx`); asking someone to type a phrase
 * to delete one collection would train them to type it without reading.
 *
 * @param {{
 *   title: string,
 *   body?: string | string[],
 *   confirmLabel: string,
 *   cancelLabel?: string,
 *   tone?: 'danger' | 'neutral',
 * }} request
 * @returns {Promise<boolean>} true only if the named confirm button was pressed.
 */
import './confirmDialog.css'

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

let openDialog = null

export function confirmAction({
  title,
  body = '',
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'danger',
} = {}) {
  if (typeof document === 'undefined') return Promise.resolve(false)
  // One at a time. A second ask while one is open is a bug at the call site,
  // and answering it "no" is the safe reading of an unanswered question.
  if (openDialog) return Promise.resolve(false)

  return new Promise((resolve) => {
    const returnFocusTo = document.activeElement
    const previousOverflow = document.body.style.overflow

    const backdrop = document.createElement('div')
    backdrop.className = 'od-confirm'

    const panel = document.createElement('div')
    panel.className = `od-confirm__panel od-confirm__panel--${tone === 'danger' ? 'danger' : 'neutral'}`
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')

    const titleId = `od-confirm-title-${Date.now().toString(36)}`
    const heading = document.createElement('h2')
    heading.className = 'od-confirm__title'
    heading.id = titleId
    heading.textContent = title || 'Are you sure?'
    panel.setAttribute('aria-labelledby', titleId)
    panel.appendChild(heading)

    const paragraphs = (Array.isArray(body) ? body : [body]).filter(Boolean)
    if (paragraphs.length) {
      const bodyId = `${titleId}-body`
      paragraphs.forEach((text, index) => {
        const p = document.createElement('p')
        p.className = 'od-confirm__body'
        if (index === 0) p.id = bodyId
        p.textContent = text
        panel.appendChild(p)
      })
      panel.setAttribute('aria-describedby', bodyId)
    }

    const actions = document.createElement('div')
    actions.className = 'od-confirm__actions'

    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'od-btn'
    cancel.textContent = cancelLabel

    const confirm = document.createElement('button')
    confirm.type = 'button'
    confirm.className = tone === 'danger' ? 'od-btn od-btn--danger' : 'od-btn od-btn--primary'
    confirm.textContent = confirmLabel || 'Confirm'

    actions.append(cancel, confirm)
    panel.appendChild(actions)
    backdrop.appendChild(panel)

    function close(answer) {
      document.removeEventListener('keydown', onKeyDown, true)
      backdrop.remove()
      document.body.style.overflow = previousOverflow
      openDialog = null
      if (returnFocusTo && typeof returnFocusTo.focus === 'function') {
        returnFocusTo.focus()
      }
      resolve(answer)
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        close(false)
        return
      }
      if (event.key !== 'Tab') return
      // Trap: the dialog covers the page, so tabbing out of it lands on
      // controls the viewer cannot see or reach with a pointer.
      const focusable = [...panel.querySelectorAll(FOCUSABLE)]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    cancel.addEventListener('click', () => close(false))
    confirm.addEventListener('click', () => close(true))
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close(false)
    })
    document.addEventListener('keydown', onKeyDown, true)

    document.body.appendChild(backdrop)
    document.body.style.overflow = 'hidden'
    openDialog = backdrop

    // A destructive dialog opens with Cancel focused, so a stray Enter from
    // whatever the viewer was doing before cannot complete the deletion.
    if (tone === 'danger') cancel.focus()
    else confirm.focus()
  })
}
