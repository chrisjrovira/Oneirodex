/**
 * Normalize video URL lists from details payloads (CSV string, list, or embeds).
 * @param {unknown} raw
 * @returns {string[]}
 */
export function parseVideoUrls(raw) {
  if (raw == null || raw === '') return []
  if (Array.isArray(raw)) {
    return raw.map((u) => String(u).trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  }
  return []
}

/**
 * @param {string} url
 * @returns {string | null} YouTube embed URL
 */
export function youtubeEmbed(url) {
  if (!url || typeof url !== 'string') return null
  const embedMatch = url.match(/youtube\.com\/embed\/([\w-]{6,})/i)
  if (embedMatch) {
    return `https://www.youtube.com/embed/${embedMatch[1]}`
  }
  const match = url.match(/(?:youtu\.be\/|v=)([\w-]{6,})/i)
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
}

/**
 * Prefer structured `game.trailers[].embed_url` (and has_trailers) before video_urls CSV/list.
 * @param {object} game
 * @returns {string[]} Embeddable iframe src URLs
 */
export function trailerEmbedUrls(game) {
  if (!game) return []

  const structured = Array.isArray(game.trailers) ? game.trailers : []
  if (structured.length > 0 || game.has_trailers === true) {
    const fromTrailers = structured
      .map((row) => {
        if (!row || typeof row !== 'object') {
          return youtubeEmbed(String(row || ''))
        }
        const embed = row.embed_url || row.url
        return youtubeEmbed(String(embed || '')) || (embed ? String(embed).trim() : null)
      })
      .filter(Boolean)
    if (fromTrailers.length) return fromTrailers
  }

  return parseVideoUrls(game.video_urls).map(youtubeEmbed).filter(Boolean)
}

/**
 * Prefer Backend youtube_demo_url / demo_url / youtube mark when no embeddable trailers exist.
 * @param {object} game
 * @returns {{ href: string, label: string } | null}
 */
export function youtubeDemoLink(game) {
  if (!game) return null
  if (game.youtube_demo_url && /youtu(\.be|be\.com)/i.test(game.youtube_demo_url)) {
    return { href: game.youtube_demo_url, label: 'YouTube demo' }
  }
  if (game.demo_url && /youtu(\.be|be\.com)/i.test(game.demo_url)) {
    return { href: game.demo_url, label: 'YouTube demo' }
  }
  const urls = Array.isArray(game.urls) ? game.urls : []
  const yt = urls.find(
    (row) =>
      String(row?.type || '').toLowerCase().includes('youtube') ||
      /youtu(\.be|be\.com)/i.test(String(row?.url || '')),
  )
  if (yt?.url) {
    return { href: yt.url, label: 'YouTube' }
  }
  return null
}

/**
 * Admin path rows from details payload (full_disk_path / server_path / optional admin_paths).
 * @param {object} game
 * @returns {{ label: string, path: string }[]}
 */
export function adminPathRows(game) {
  if (!game?.is_admin) return []
  const rows = []
  const seen = new Set()

  function push(label, path) {
    const trimmed = String(path || '').trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    rows.push({ label, path: trimmed })
  }

  if (Array.isArray(game.admin_paths)) {
    for (const row of game.admin_paths) {
      if (typeof row === 'string') {
        push('Path', row)
      } else if (row && typeof row === 'object') {
        push(row.label || row.kind || 'Path', row.path || row.full_disk_path || row.server_path)
      }
    }
  }

  push('Library folder', game.full_disk_path)
  push('Server path', game.server_path)
  if (game.paths && typeof game.paths === 'object') {
    for (const [key, value] of Object.entries(game.paths)) {
      push(key, value)
    }
  }

  return rows
}

/**
 * Wave 14b — whether a version/extra row may offer Download.
 * Honest when Backend sends `downloadable` / `path_missing`; otherwise assume downloadable.
 * @param {object | null | undefined} row
 * @returns {boolean}
 */
export function isVersionDownloadable(row) {
  if (!row || typeof row !== 'object') return false
  if (row.downloadable === false) return false
  if (row.path_missing === true) return false
  return true
}

/**
 * Quiet “Missing on disk” affordance when Backend marks the path gone or not downloadable.
 * @param {object | null | undefined} row
 * @returns {boolean}
 */
export function isVersionPathMissing(row) {
  if (!row || typeof row !== 'object') return false
  return row.path_missing === true || row.downloadable === false
}

/**
 * Format size for version rows (string as-is, or humanize bytes when numeric).
 * @param {unknown} size
 * @returns {string | null}
 */
export function formatVersionSize(size) {
  if (size == null || size === '') return null
  if (typeof size === 'string') {
    const trimmed = size.trim()
    return trimmed || null
  }
  const bytes = Number(size)
  if (!Number.isFinite(bytes) || bytes < 0) return null
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const rounded = value >= 10 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[unit]}`
}

/**
 * Extras / DLC rows — prefer Backend `extras` contract; else versions kind=extra.
 * @param {object} game
 * @param {object[]} versions
 * @returns {{ rows: object[], source: 'extras' | 'versions' | 'empty', loading: boolean }}
 */
export function extrasPanelModel(game, versions, { loading = false } = {}) {
  if (loading) {
    return { rows: [], source: 'empty', loading: true }
  }

  if (Array.isArray(game?.extras)) {
    const rows = game.extras.map((row) => ({
      id: row.uuid || row.id || row.name || row.label,
      label: row.name || row.label || 'Extra',
      kind: row.extra_kind || row.type || row.kind || 'extra',
      type: row.type || row.extra_kind || row.kind || null,
      on_server: row.on_server,
      size: row.size,
      uuid: row.uuid,
      download_url: isVersionDownloadable(row) ? row.download_url : null,
      path_missing: row.path_missing === true || row.downloadable === false,
      downloadable: isVersionDownloadable(row),
    }))
    return { rows, source: 'extras', loading: false }
  }

  const fromVersions = (Array.isArray(versions) ? versions : [])
    .filter((row) => row.kind === 'extra')
    .map((row) => ({
      id: row.uuid || row.id,
      label: row.label || row.name || 'Extra',
      kind: row.extra_kind || row.type || 'extra',
      type: row.type || row.extra_kind || null,
      on_server: row.on_server,
      size: row.size,
      uuid: row.uuid,
      download_url: isVersionDownloadable(row)
        ? `/download_other/extra/${game?.uuid}/${row.uuid}`
        : null,
      path_missing: isVersionPathMissing(row),
      downloadable: isVersionDownloadable(row),
    }))

  return {
    rows: fromVersions,
    source: fromVersions.length ? 'versions' : 'empty',
    loading: false,
  }
}
