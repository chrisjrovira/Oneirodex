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

function csrfHeaders(additionalHeaders = {}) {
  if (window.CSRFUtils?.getHeaders) {
    return window.CSRFUtils.getHeaders(additionalHeaders)
  }

  return {
    'X-CSRFToken': getCsrfToken(),
    ...additionalHeaders,
  }
}

/**
 * Queue Install / Update / Uninstall for the desktop companion to claim.
 * @param {string} gameUuid
 * @param {'install' | 'update' | 'uninstall'} action
 */
export async function queueClientCommand(gameUuid, action) {
  const response = await fetch('/api/client/commands', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ game_uuid: gameUuid, action }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data?.error || `client/commands ${response.status}`)
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}
