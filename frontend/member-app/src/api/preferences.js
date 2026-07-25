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