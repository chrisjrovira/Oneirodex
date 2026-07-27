export async function fetchOpsSummary({ signal } = {}) {
  const response = await fetch('/admin/api/ops/summary', {
    signal,
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Ops summary failed: ${response.status}`)
  }

  return response.json()
}
