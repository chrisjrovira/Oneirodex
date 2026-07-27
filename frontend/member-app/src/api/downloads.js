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

export async function fetchMyDownloads({ signal } = {}) {
  const response = await fetch('/api/my_downloads', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`my_downloads ${response.status}`)
  }

  return response.json()
}

export async function checkStatus(id, { signal } = {}) {
  const response = await fetch(`/check_download_status/${id}`, {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`check_download_status ${response.status}`)
  }

  return response.json()
}

export async function deleteDownload(id) {
  const csrf = getCsrfToken()
  const body = new FormData()
  if (csrf) {
    body.append('csrf_token', csrf)
  }

  const response = await fetch(`/delete_download/${id}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders(),
    body,
  })

  if (!response.ok && response.status !== 302) {
    throw new Error(`delete_download ${response.status}`)
  }

  return true
}
