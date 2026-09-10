/**
 * Open the server-rendered preferences modal used by the SPA shells.
 *
 * Moved here from `member-app/src/api/preferences.js` (PR-4 d) so the admin
 * shell can open it without the `@member` cross-app alias. It touches only
 * `document`, `window.bootstrap` and `fetch('/settings_panel')` — no member
 * dependencies.
 *
 * Theme tokens live in the volume-served `od-tokens.css` stylesheet, so theme
 * changes saved in this modal trigger a full page reload (`preferences_modal.js`
 * calls `window.location.reload()` after a successful save). Keep that contract
 * if you add SPA-side theme saves.
 */

interface BootstrapModal {
  show(): void
}

interface BootstrapModalStatic {
  getOrCreateInstance(element: Element): BootstrapModal
}

declare global {
  interface Window {
    bootstrap?: { Modal?: BootstrapModalStatic }
    odHoistBootstrapModals?: (element: Element) => void
  }
}

export async function openPreferencesModal(): Promise<void> {
  const container = document.getElementById('preferencesModalContainer')
  if (!container) {
    throw new Error('preferences modal container missing')
  }

  const res = await fetch('/settings_panel', {
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
  if (!res.ok) {
    // Not errorFromResponse: /settings_panel renders HTML, so there is no
    // envelope to read and a parse attempt would only cost a round trip.
    throw new Error('preferences load failed')
  }

  const html = await res.text()
  container.innerHTML = html

  const modalElement = document.getElementById('preferencesModal')
  if (!modalElement) {
    throw new Error('preferences modal markup missing')
  }

  if (typeof window.odHoistBootstrapModals === 'function') {
    window.odHoistBootstrapModals(modalElement)
  }

  const bootstrap = window.bootstrap
  if (bootstrap?.Modal) {
    bootstrap.Modal.getOrCreateInstance(modalElement).show()
    return
  }

  modalElement.style.display = 'block'
  modalElement.classList.add('show')
}
