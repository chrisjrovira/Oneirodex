/**
 * Member preferences helpers.
 *
 * Theme tokens live in the volume-served `od-tokens.css` stylesheet. Changing
 * theme from the SPA (Preferences modal or `/settings_panel`) must end in a
 * full page reload so that stylesheet is re-fetched. The theme preferences
 * modal (`preferences_modal.js`) already calls `window.location.reload()` after
 * a successful save — keep that contract if you add SPA-side theme saves here.
 */

import { csrfHeaders, errorFromResponse, getCsrfToken } from '@oneirodex/ui'
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
    // `csrf` above is still read directly: this endpoint also wants the token
    // as a form field, which headers cannot supply.
    headers: csrfHeaders({ 'X-Requested-With': 'XMLHttpRequest' }),
    body,
  })

  if (!res.ok) {
    throw await errorFromResponse(res, 'preferences save failed')
  }

  return res.json().catch(() => ({}))
}

/**
 * Every field the preferences form validates, not just the one being changed.
 *
 * `/settings_panel` validates the whole `UserPreferencesForm`, and WTForms
 * reads an absent checkbox as False. So a save that omits `show_tile_titles` —
 * dragging the tile-size slider, say — would quietly switch the title strip
 * off. Anything added to that form has to be carried here too.
 */
export function preferencesFromShell(shellConfig = {}, partial = {}) {
  return {
    items_per_page: shellConfig.perPage ?? 20,
    default_sort: shellConfig.defaultSort || 'name',
    default_sort_order: shellConfig.defaultSortOrder || 'asc',
    theme: shellConfig.theme || 'default',
    show_tile_titles: shellConfig.showTileTitles === false ? 'false' : 'true',
    ...partial,
  }
}

/**
 * Open the server-rendered preferences modal used by the SPA shells.
 *
 * Moved into `@oneirodex/ui` (PR-4 d) so the admin shell can open it without the
 * `@member` cross-app alias. Re-exported here so `CommandPalette` / `TopBar` and
 * their tests keep importing it from `../api/preferences`.
 */
export { openPreferencesModal } from '@oneirodex/ui'
