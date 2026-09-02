import { safeHttpUrl } from '../utils/safeUrl'
import maskAmazon from '../assets/store-brands/amazon.png'
import maskEa from '../assets/store-brands/ea.png'
import maskFandom from '../assets/store-brands/fandom.png'
import maskHumble from '../assets/store-brands/humble.png'
import maskItch from '../assets/store-brands/itch.png'
import maskPlaystation from '../assets/store-brands/playstation.png'
import maskUnknown from '../assets/store-brands/unknown.png'
import maskXbox from '../assets/store-brands/xbox.png'
import './ExternalStoreLinks.css'

/**
 * Recognizable brand marks — SVG paths (fill=currentColor) or PNG silhouettes
 * rendered via CSS mask-image + currentColor so icons follow light/dark aurora.
 * Chip chrome keeps --od-store-color for border/hover only.
 */
const BRANDS = [
  {
    id: 'steam',
    match: (type, url) => /steam/i.test(type || '') || /steampowered\.com|steamcommunity\.com/i.test(url || ''),
    label: 'Steam',
    color: '#66c0f4',
    // Steam valve mark
    paths: [
      'M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.917c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.962 20.307 6.59 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0zM7.54 18.205l-1.473-.61c.262.543.714 1.001 1.295 1.286 1.264.615 2.777.07 3.395-1.192.3-.602.336-1.26.14-1.858l-1.524.625c.1.371.037.786-.168 1.174-.264.501-.769.817-1.314.817-.297 0-.587-.09-.84-.263a1.703 1.703 0 0 1-.51-.979zm10.048-7.294c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z',
    ],
  },
  {
    id: 'gog',
    match: (type, url) => /gog/i.test(type || '') || /gog\.com/i.test(url || ''),
    label: 'GOG',
    color: '#86328a',
    // GOG.com wordmark-style monogram
    paths: [
      'M4.2 7.2c1.1-1.4 2.8-2.2 4.7-2.2 2.6 0 4.3 1.5 4.3 3.8 0 2.5-1.9 3.9-4.5 3.9-.7 0-1.4-.1-2-.3v4.8H4.2V7.2zm2.5 3.6c.4.2.9.3 1.5.3 1.4 0 2.2-.7 2.2-1.9s-.8-1.8-2.1-1.8c-.7 0-1.3.2-1.6.5v2.9zM14.2 12.4c0-2.5 1.9-4.1 4.5-4.1.9 0 1.7.2 2.3.5l-.7 1.9c-.5-.2-1-.3-1.5-.3-1.4 0-2.3.8-2.3 2.1 0 1.3.9 2.1 2.3 2.1.6 0 1.1-.1 1.6-.4l.6 1.8c-.7.4-1.6.6-2.6.6-2.7 0-4.2-1.7-4.2-4.2z',
    ],
  },
  {
    id: 'epic',
    match: (type, url) => /epic/i.test(type || '') || /epicgames\.com/i.test(url || ''),
    label: 'Epic',
    color: '#ffffff',
    // Epic Games stylized "E" shield silhouette
    paths: [
      'M4 3.5h16v2.2H7.2v4.2h11.2v2.1H7.2v4.4H20.5V18.5H4z',
    ],
  },
  {
    id: 'playstation',
    match: (type, url) =>
      /playstation|\bpsn\b/i.test(type || '') || /store\.playstation|playstation\.com/i.test(url || ''),
    label: 'PlayStation',
    color: '#0070d1',
    mask: maskPlaystation,
  },
  {
    id: 'xbox',
    match: (type, url) =>
      /xbox|microsoft/i.test(type || '') || /xbox\.com|microsoft\.com\/.*xbox/i.test(url || ''),
    label: 'Xbox',
    color: '#107c10',
    mask: maskXbox,
  },
  {
    id: 'amazon',
    match: (type, url) =>
      /amazon|luna|prime\s*gaming|primegaming/i.test(type || '') ||
      /amazon\.com|luna\.amazon|primegaming|gaming\.amazon/i.test(url || ''),
    label: 'Amazon',
    color: '#ff9900',
    mask: maskAmazon,
  },
  {
    id: 'humble',
    match: (type, url) => /humble/i.test(type || '') || /humblebundle\.com/i.test(url || ''),
    label: 'Humble',
    color: '#cc2929',
    mask: maskHumble,
  },
  {
    id: 'itch',
    match: (type, url) => /itch/i.test(type || '') || /itch\.io/i.test(url || ''),
    label: 'itch.io',
    color: '#fa5c5c',
    mask: maskItch,
  },
  {
    id: 'ea',
    match: (type, url) =>
      /\bea\b|origin|ea\s*play|eaplay/i.test(type || '') ||
      /ea\.com|origin\.com|store\.ea\.com/i.test(url || ''),
    label: 'EA',
    color: '#ff4747',
    mask: maskEa,
  },
  {
    id: 'ubisoft',
    match: (type, url) =>
      /ubisoft|uplay|ubi\s*connect/i.test(type || '') || /ubisoft\.com|store\.ubi\.com|uplay/i.test(url || ''),
    label: 'Ubisoft',
    color: '#0084ff',
    // Recreated monochrome mark — supplied PNG was solid black / unusable
    paths: [
      'M23.561 11.988C23.301-.304 6.954-4.89.656 6.634c.282.206.661.477.943.672a11.747 11.747 0 00-.976 3.067 11.885 11.885 0 00-.184 2.071C.439 18.818 5.621 24 12.005 24c6.385 0 11.556-5.17 11.556-11.556v-.455zm-20.27 2.06c-.152 1.246-.054 1.636-.054 1.788l-.282.098c-.108-.206-.37-.932-.488-1.908C2.163 10.308 4.7 6.96 8.57 6.33c3.544-.52 6.937 1.68 7.728 4.758l-.282.098c-.087-.087-.228-.336-.77-.878-4.281-4.281-11.002-2.32-11.956 3.74zm11.002 2.081a3.145 3.145 0 01-2.59 1.355 3.15 3.15 0 01-3.155-3.155 3.159 3.159 0 012.927-3.144c1.018-.043 1.972.51 2.416 1.398a2.58 2.58 0 01-.455 2.95c.293.205.575.4.856.595zm6.58.12c-1.669 3.782-5.106 5.766-8.77 5.712-7.034-.347-9.083-8.466-4.38-11.393l.207.206c-.076.108-.358.325-.791 1.182-.51 1.041-.672 2.081-.607 2.732.369 5.67 8.314 6.83 11.045 1.214C21.057 8.217 11.822.401 3.626 6.374l-.184-.184C5.599 2.808 9.816 1.3 13.837 2.309c6.147 1.55 9.453 7.956 7.035 13.94z',
    ],
  },
  {
    id: 'fandom',
    match: (type, url) =>
      /fandom|wikia/i.test(type || '') || /fandom\.com|wikia\.com/i.test(url || ''),
    label: 'Fandom',
    color: '#fa005a',
    mask: maskFandom,
  },
  {
    id: 'igdb',
    match: (type, url) => /igdb/i.test(type || '') || /igdb\.com/i.test(url || ''),
    label: 'IGDB',
    color: '#9146ff',
    paths: [
      'M3.5 4.5h4.2v15H3.5zm6.2 0h4.2v6.2H9.7zm0 8.8h4.2v6.2H9.7zm6.2-8.8H20v15h-4.1z',
    ],
  },
  {
    id: 'youtube',
    match: (type, url) => /youtube|youtu\.be/i.test(type || '') || /youtube\.com|youtu\.be/i.test(url || ''),
    label: 'YouTube',
    color: '#ff0000',
    paths: [
      'M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.75 15.57V8.43L15.84 12z',
    ],
  },
  {
    id: 'wikipedia',
    match: (type, url) => /wikipedia/i.test(type || '') || /wikipedia\.org/i.test(url || ''),
    label: 'Wikipedia',
    color: '#e0e0e0',
    // Wikipedia "W"
    paths: [
      'M3.2 5.2h2.3l1.55 5.9L9.4 5.2h2.15l2.35 5.9 1.55-5.9h2.35l-2.9 13.1h-2.2l-2.45-6.55-2.45 6.55H5.1z',
    ],
  },
  {
    id: 'official',
    match: (type) => /official|website|homepage/i.test(type || ''),
    label: 'Official site',
    color: '#2fd67b',
    paths: [
      'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm6.9 9H15.4a15.6 15.6 0 0 0-1.3-5.2A8.05 8.05 0 0 1 18.9 11zM12 4c.9 0 2.2 2.3 2.9 6H9.1C9.8 6.3 11.1 4 12 4zM5.1 13a15.6 15.6 0 0 0 1.3 5.2A8.05 8.05 0 0 1 5.1 13zm0-2a8.05 8.05 0 0 1 1.3-5.2A15.6 15.6 0 0 0 5.1 11zM12 20c-.9 0-2.2-2.3-2.9-6h5.8c-.7 3.7-2 6-2.9 6zm2.7-1.8a15.6 15.6 0 0 0 1.3-5.2h3.5a8.05 8.05 0 0 1-4.8 5.2z',
    ],
  },
  {
    id: 'facebook',
    match: (type, url) => /facebook/i.test(type || '') || /facebook\.com|fb\.com/i.test(url || ''),
    label: 'Facebook',
    color: '#1877f2',
    paths: [
      'M14 8h2.5V5.2c-.4-.1-1.6-.2-3-.2-3 0-5 1.8-5 5.1V12H6v3.2h2.5V22h3.2v-6.8H15l.5-3.2h-3.2V10.4c0-.9.3-1.6 1.7-1.6z',
    ],
  },
  {
    id: 'twitter',
    match: (type, url) => /twitter|x\.com/i.test(type || '') || /twitter\.com|(?:^|\/\/)(?:www\.)?x\.com/i.test(url || ''),
    label: 'X',
    color: '#e7e9ea',
    paths: [
      'M17.6 3.5h2.6l-5.7 6.5L22 20.5h-5.8l-4.5-5.9-5.2 5.9H3.9l6.1-7L2.2 3.5h6l4.1 5.4 5.3-5.4zm-.9 15.3h1.4L7.4 4.9H5.9l10.8 13.9z',
    ],
  },
  {
    id: 'twitch',
    match: (type, url) => /twitch/i.test(type || '') || /twitch\.tv/i.test(url || ''),
    label: 'Twitch',
    color: '#9146ff',
    paths: [
      'M3.5 2.5 2 6v14.5h5V22l2.5-1.5H14L20.5 14V2.5H3.5zm15.5 10.5-3.5 3.5h-3.5l-2.5 1.5v-1.5H6.5V4.5h12.5v8.5zM14 7h2v5h-2V7zm-5 0h2v5H9V7z',
    ],
  },
  {
    id: 'instagram',
    match: (type, url) => /instagram/i.test(type || '') || /instagram\.com/i.test(url || ''),
    label: 'Instagram',
    color: '#e4405f',
    paths: [
      'M12 7.2A4.8 4.8 0 1 0 16.8 12 4.8 4.8 0 0 0 12 7.2zm0 7.9A3.1 3.1 0 1 1 15.1 12 3.1 3.1 0 0 1 12 15.1zM17.9 6.9a1.1 1.1 0 1 1-1.1-1.1 1.1 1.1 0 0 1 1.1 1.1zM12 3.5c-2.3 0-2.6 0-3.5.1a5.4 5.4 0 0 0-3.6 1.5 5.4 5.4 0 0 0-1.5 3.6c-.1.9-.1 1.2-.1 3.5s0 2.6.1 3.5a5.4 5.4 0 0 0 1.5 3.6 5.4 5.4 0 0 0 3.6 1.5c.9.1 1.2.1 3.5.1s2.6 0 3.5-.1a5.4 5.4 0 0 0 3.6-1.5 5.4 5.4 0 0 0 1.5-3.6c.1-.9.1-1.2.1-3.5s0-2.6-.1-3.5a5.4 5.4 0 0 0-1.5-3.6 5.4 5.4 0 0 0-3.6-1.5c-.9-.1-1.2-.1-3.5-.1zm0 1.5c2.3 0 2.5 0 3.4.1a3.9 3.9 0 0 1 2.6 1 3.9 3.9 0 0 1 1 2.6c.1.9.1 1.1.1 3.4s0 2.5-.1 3.4a3.9 3.9 0 0 1-1 2.6 3.9 3.9 0 0 1-2.6 1c-.9.1-1.1.1-3.4.1s-2.5 0-3.4-.1a3.9 3.9 0 0 1-2.6-1 3.9 3.9 0 0 1-1-2.6c-.1-.9-.1-1.1-.1-3.4s0-2.5.1-3.4a3.9 3.9 0 0 1 1-2.6 3.9 3.9 0 0 1 2.6-1c.9-.1 1.1-.1 3.4-.1z',
    ],
  },
  {
    id: 'reddit',
    match: (type, url) => /reddit/i.test(type || '') || /reddit\.com/i.test(url || ''),
    label: 'Reddit',
    color: '#ff4500',
    paths: [
      'M12 2.5A9.5 9.5 0 1 0 21.5 12 9.5 9.5 0 0 0 12 2.5zm5.3 8.2a1.2 1.2 0 0 1 1.2 1.2 1.2 1.2 0 0 1-.7 1.1c.1.4.1.8.1 1.2 0 2.1-2.4 3.8-5.4 3.8s-5.4-1.7-5.4-3.8c0-.4 0-.8.1-1.2a1.2 1.2 0 1 1 1.6-1.7 5.8 5.8 0 0 1 3.2-1l.6-2.8a.6.6 0 0 1 .7-.5l2 .4a1.2 1.2 0 1 1 .1.9l-1.7-.4-.5 2.4a5.8 5.8 0 0 1 3.2 1zm-7.1 2.2a1 1 0 1 1 1 1 1 1 0 0 1-1-1zm5.1 2.7a3.6 3.6 0 0 1-3.3 1.1 3.6 3.6 0 0 1-3.3-1.1.4.4 0 0 1 .6-.6 2.8 2.8 0 0 0 2.7.9 2.8 2.8 0 0 0 2.7-.9.4.4 0 1 1 .6.6zm-.5-1.7a1 1 0 1 1 1-1 1 1 0 0 1-1 1z',
    ],
  },
  {
    id: 'android',
    match: (type, url) => /android/i.test(type || '') || /play\.google\.com/i.test(url || ''),
    label: 'Android',
    color: '#3ddc84',
    paths: [
      'M17.6 9.2 19.2 6a.6.6 0 1 0-1-.6l-1.6 3.1A9.4 9.4 0 0 0 12 7.4a9.4 9.4 0 0 0-4.6 1.1L5.8 5.4a.6.6 0 1 0-1 .6l1.6 3.2A8.7 8.7 0 0 0 3.5 15.5v.7h17v-.7a8.7 8.7 0 0 0-2.9-6.3zM8.2 13.4a.9.9 0 1 1 .9-.9.9.9 0 0 1-.9.9zm7.6 0a.9.9 0 1 1 .9-.9.9.9 0 0 1-.9.9zM5.2 17.5h2.2V21a1 1 0 0 0 2 0v-3.5h5.2V21a1 1 0 0 0 2 0v-3.5h2.2v2.2a8.8 8.8 0 0 1-13.6 0z',
    ],
  },
  {
    id: 'apple',
    match: (type, url) => /iphone|ipad|apple|ios/i.test(type || '') || /apps\.apple\.com|itunes\.apple\.com/i.test(url || ''),
    label: 'App Store',
    color: '#e8e8e8',
    paths: [
      'M18.7 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 3 2.3 1.2 0 1.6-.8 3.1-.8s1.8.8 3.1.7c1.3 0 2.1-1.1 2.9-2.2.9-1.3 1.3-2.6 1.3-2.6s-2.3-.9-2.3-3.6zM15.9 5.6c.7-.8 1.1-1.9 1-3.1-1 .1-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.5 2.9-1.4z',
    ],
  },
]

const UNKNOWN_FALLBACK = {
  id: 'unknown',
  label: 'Link',
  color: '#8899aa',
  mask: maskUnknown,
}

function brandFor(row) {
  const type = row?.type || ''
  const url = row?.url || ''
  const matched = BRANDS.find((brand) => brand.match(type, url))
  if (matched) return matched
  return {
    ...UNKNOWN_FALLBACK,
    label: type || UNKNOWN_FALLBACK.label,
  }
}

function BrandIcon({ brand }) {
  if (brand.mask) {
    return (
      <span
        className="od-store-link__icon od-store-link__icon--mask"
        style={{ '--od-store-mask': `url("${brand.mask}")` }}
        aria-hidden="true"
      />
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="od-store-link__icon">
      {brand.paths.map((d) => (
        <path key={d.slice(0, 24)} fill="currentColor" d={d} />
      ))}
    </svg>
  )
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
    <ul className="od-store-links" aria-label="Store and catalog links">
      {rows.map((row) => {
        const brand = brandFor(row)
        return (
          <li key={row.url} className="od-store-links__item">
            <a
              className={`od-store-link od-store-link--${brand.id}`}
              href={row.url}
              target="_blank"
              rel="noreferrer"
              title={brand.label}
              aria-label={brand.label}
              style={{ '--od-store-color': brand.color }}
            >
              <BrandIcon brand={brand} />
              <span className="od-store-link__label">{brand.label}</span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
