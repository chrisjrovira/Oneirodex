import { safeHttpUrl } from '../utils/safeUrl'
import './ExternalStoreLinks.css'

const BRANDS = [
  {
    id: 'steam',
    match: (type, url) => /steam/i.test(type || '') || /steampowered\.com|steamcommunity\.com/i.test(url || ''),
    label: 'Steam',
    color: '#1b2838',
    path: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm4.2 7.1-3.6 1.5a2.4 2.4 0 0 0-3.3 2.2 2.4 2.4 0 0 0 2.4 2.4 2.4 2.4 0 0 0 2.2-3.4l1.5-3.6a.6.6 0 0 0-.2-.8.6.6 0 0 0-.8.2Z',
  },
  {
    id: 'gog',
    match: (type, url) => /gog/i.test(type || '') || /gog\.com/i.test(url || ''),
    label: 'GOG',
    color: '#86328a',
    path: 'M4 7h16v2H4zm0 4h10v2H4zm0 4h14v2H4z',
  },
  {
    id: 'epic',
    match: (type, url) => /epic/i.test(type || '') || /epicgames\.com/i.test(url || ''),
    label: 'Epic',
    color: '#2a2a2a',
    path: 'M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3zm0 2.2 5.5 2.1v4.7c0 3.5-2.2 6-5.5 6.7-3.3-.7-5.5-3.2-5.5-6.7V7.3L12 5.2z',
  },
  {
    id: 'igdb',
    match: (type, url) => /igdb/i.test(type || '') || /igdb\.com/i.test(url || ''),
    label: 'IGDB',
    color: '#9147ff',
    path: 'M5 5h4v14H5zm5 0h4v6h-4zm0 8h4v6h-4zm5-8h4v14h-4z',
  },
  {
    id: 'youtube',
    match: (type, url) => /youtube|youtu\.be/i.test(type || '') || /youtube\.com|youtu\.be/i.test(url || ''),
    label: 'YouTube',
    color: '#c4302b',
    path: 'M21 8.5a3 3 0 0 0-2.1-2.1C17.2 6 12 6 12 6s-5.2 0-6.9.4A3 3 0 0 0 3 8.5 31 31 0 0 0 3 12a31 31 0 0 0 .1 3.5 3 3 0 0 0 2.1 2.1C6.8 18 12 18 12 18s5.2 0 6.9-.4a3 3 0 0 0 2.1-2.1A31 31 0 0 0 21 12a31 31 0 0 0 0-3.5zM10 14.5v-5l4.5 2.5z',
  },
  {
    id: 'wikipedia',
    match: (type, url) => /wiki/i.test(type || '') || /wikipedia\.org/i.test(url || ''),
    label: 'Wikipedia',
    color: '#333',
    path: 'M4 6h2l2.5 7L12 6h2l3.2 7L20 6h2l-4.2 12h-2L13 10.2 10.2 18h-2z',
  },
  {
    id: 'official',
    match: (type) => /official|website|homepage/i.test(type || ''),
    label: 'Site',
    color: '#2fd67b',
    path: 'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9zm0 2a7 7 0 0 1 6.7 5H5.3A7 7 0 0 1 12 5zm-7 8h14a7 7 0 0 1-14 0z',
  },
]

function brandFor(row) {
  const type = row?.type || ''
  const url = row?.url || ''
  return BRANDS.find((brand) => brand.match(type, url)) || {
    id: 'link',
    label: type || 'Link',
    color: '#445',
    path: 'M10 13a5 5 0 0 0 7.1 0l1.4-1.4a5 5 0 0 0-7.1-7.1L10 5.9M14 11a5 5 0 0 0-7.1 0L5.5 12.4a5 5 0 0 0 7.1 7.1L14 18.1',
  }
}

/**
 * Compact brand logo buttons for store / catalog links on details.
 */
export function ExternalStoreLinks({ urls = [], steamUrl, igdbUrl }) {
  const rows = []
  const seen = new Set()

  function push(row) {
    const href = safeHttpUrl(row.url)
    if (!href || seen.has(href)) return
    seen.add(href)
    rows.push({ ...row, url: href })
  }

  if (steamUrl) push({ type: 'steam', url: steamUrl })
  if (igdbUrl) push({ type: 'igdb', url: igdbUrl })
  for (const row of urls) push(row)

  if (!rows.length) return null

  return (
    <div className="gt-store-links" role="list" aria-label="Store and catalog links">
      {rows.map((row) => {
        const brand = brandFor(row)
        return (
          <a
            key={row.url}
            role="listitem"
            className="gt-store-link"
            href={row.url}
            target="_blank"
            rel="noreferrer"
            title={brand.label}
            style={{ '--gt-store-color': brand.color }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="gt-store-link__icon">
              <path fill="currentColor" d={brand.path} />
            </svg>
            <span className="gt-store-link__label">{brand.label}</span>
          </a>
        )
      })}
    </div>
  )
}
