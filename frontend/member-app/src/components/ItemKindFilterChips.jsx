/** Kind chip toggles for library browse (maps to /browse_games item_kind). */

import { ITEM_KINDS, ITEM_KIND_LABEL, ITEM_KIND_LABEL_PLURAL } from '../utils/itemKind'

/** Chips shown in the Library Kind filter row. */
export const ITEM_KIND_FILTER_CHIPS = ITEM_KINDS.map((kind) => ({
  kind,
  label: ITEM_KIND_LABEL_PLURAL[kind],
  title: ITEM_KIND_LABEL[kind],
}))

const KIND_ALIASES = Object.freeze({
  game: 'game',
  games: 'game',
  experience: 'experience',
  experiences: 'experience',
  'soft title': 'experience',
  soft_title: 'experience',
  'soft-title': 'experience',
  softtitles: 'experience',
  'soft titles': 'experience',
  emulator: 'emulator',
  emulators: 'emulator',
  emu: 'emulator',
  tool: 'tool',
  tools: 'tool',
  utility: 'tool',
  utilities: 'tool',
})

/**
 * Normalize a raw kind token to a canonical ITEM_KINDS value, or null.
 * @param {string} raw
 * @returns {'game' | 'experience' | 'emulator' | 'tool' | null}
 */
export function normalizeItemKindToken(raw) {
  const key = String(raw || '')
    .trim()
    .toLowerCase()
  return KIND_ALIASES[key] ?? null
}

/**
 * Parse an item_kind / content_kind filter value into canonical kinds (stable order).
 * @param {string | null | undefined} value
 * @returns {Array<'game' | 'experience' | 'emulator' | 'tool'>}
 */
export function parseItemKindFilter(value) {
  if (value == null || value === '') {
    return []
  }
  const seen = new Set()
  const kinds = []
  for (const part of String(value).split(',')) {
    const kind = normalizeItemKindToken(part)
    if (kind && !seen.has(kind)) {
      seen.add(kind)
      kinds.push(kind)
    }
  }
  return ITEM_KINDS.filter((kind) => seen.has(kind))
}

/**
 * Format selected kinds as a comma-joined browse param, or '' when empty (omit).
 * @param {Iterable<string>} kinds
 * @returns {string}
 */
export function formatItemKindFilter(kinds) {
  const selected = new Set(parseItemKindFilter([...kinds].join(',')))
  return ITEM_KINDS.filter((kind) => selected.has(kind)).join(',')
}

/**
 * @param {URLSearchParams} searchParams
 * @returns {Record<string, string>}
 */
export function itemKindFromSearchParams(searchParams) {
  const raw = searchParams.get('item_kind') ?? searchParams.get('content_kind')
  const formatted = formatItemKindFilter(parseItemKindFilter(raw))
  return formatted ? { item_kind: formatted } : {}
}

/**
 * Toggle a kind in the multi-select item_kind filter and apply via onApply.
 * Empty selection omits the param (all kinds).
 * @param {object} filters
 * @param {'game' | 'experience' | 'emulator' | 'tool'} kind
 * @param {(next: object) => void} onApply
 * @param {(filters: object) => object} cleanFilters
 */
export function toggleItemKindFilter(filters, kind, onApply, cleanFilters) {
  const canonical = normalizeItemKindToken(kind)
  if (!canonical) {
    onApply(cleanFilters({ ...filters }))
    return
  }
  const current = new Set(parseItemKindFilter(filters.item_kind))
  if (current.has(canonical)) {
    current.delete(canonical)
  } else {
    current.add(canonical)
  }
  const next = { ...filters }
  const formatted = formatItemKindFilter(current)
  if (formatted) {
    next.item_kind = formatted
  } else {
    delete next.item_kind
  }
  delete next.content_kind
  onApply(cleanFilters(next))
}

export function ItemKindFilterChips({
  filters,
  onApply,
  cleanFilters,
  t = (key) => key,
}) {
  const selected = new Set(parseItemKindFilter(filters.item_kind))
  return (
    <div className="gt-badge-filter-chips" role="group" aria-label={t('Kind filters')}>
      {ITEM_KIND_FILTER_CHIPS.map((chip) => {
        const active = selected.has(chip.kind)
        return (
          <button
            key={chip.kind}
            type="button"
            className={`gt-badge-filter-chip${active ? ' is-active' : ''}`}
            aria-pressed={active}
            title={t(chip.title)}
            onClick={() => toggleItemKindFilter(filters, chip.kind, onApply, cleanFilters)}
          >
            {t(chip.label)}
          </button>
        )
      })}
    </div>
  )
}
