/**
 * Member preferences helpers.
 *
 * Theme tokens live in the volume-served `gt-tokens.css` stylesheet. Changing
 * theme from the SPA (Preferences modal or `/settings_panel`) must end in a
 * full page reload so that stylesheet is re-fetched. The theme preferences
 * modal (`preferences_modal.js`) already calls `window.location.reload()` after
 * a successful save — keep that contract if you add SPA-side theme saves here.
 */

function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]')
  if (meta?.content) {
    return meta.content
  }

  const input = document.querySelector('input[name="csrf_token"]')
  if (input?.value) {
    return input.value
  }

  return document.getElementById('csrf_token')?.textContent || ''
}

export async function savePreferences(partial) {
  const csrf = getCsrfToken()
  const body = new FormData()
  Object.entries(partial).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      body.append(key, value)
    }
  })
  if (csrf && partial.csrf_token === undefined) {
    body.append('csrf_token', csrf)
  }

  const res = await fetch('/settings_panel', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'X-CSRFToken': csrf,
      'X-Requested-With': 'XMLHttpRequest',
    },
    body,
  })

  if (!res.ok) {
    throw new Error('prefs save failed')
  }

  return res.json().catch(() => ({}))
}

export function preferencesFromShell(shellConfig = {}, partial = {}) {
  return {
    items_per_page: shellConfig.perPage ?? 20,
    default_sort: shellConfig.defaultSort || 'name',
    default_sort_order: shellConfig.defaultSortOrder || 'asc',
    theme: shellConfig.theme || 'default',
    ...partial,
  }
}

/**
 * Open the server-rendered preferences modal used by the member SPA shell.
 * Theme changes saved there trigger a full reload (see module docstring).
 */
export async function openPreferencesModal() {
  const container = document.getElementById('preferencesModalContainer')
  if (!container) {
    throw new Error('preferences modal container missing')
  }

  const res = await fetch('/settings_panel', {
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  })
  if (!res.ok) {
    throw new Error('preferences load failed')
  }

  const html = await res.text()
  container.innerHTML = html

  const modalElement = document.getElementById('preferencesModal')
  if (!modalElement) {
    throw new Error('preferences modal markup missing')
  }

  const bootstrap = window.bootstrap
  if (bootstrap?.Modal) {
    bootstrap.Modal.getOrCreateInstance(modalElement).show()
    return
  }

  modalElement.style.display = 'block'
  modalElement.classList.add('show')
}
