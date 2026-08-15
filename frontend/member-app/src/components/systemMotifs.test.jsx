import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { LoadingMotif, normalizeLoadingMotifId } from './LoadingMotif'
import { SYSTEM_MOTIFS, SYSTEM_MOTIF_FAMILIES } from './systemMotifCatalogue'
import { SYSTEM_MOTIF_ARCHETYPES } from './systemMotifArt'

/**
 * Per-system loading motifs (GT-B24).
 *
 * The catalogue is generated from LibraryPlatform, so the risk is not a typo in
 * one entry — it is the generator drifting from what the renderer can actually
 * draw. A system whose archetype has no drawing renders an empty box, which
 * reads as "nothing is loading" rather than as a missing asset.
 */

describe('catalogue', () => {
  test('covers every system with a unique id', () => {
    const ids = SYSTEM_MOTIFS.map((m) => m.id)
    expect(ids.length).toBeGreaterThan(60)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('every entry names a drawable archetype', () => {
    // The generator assigns archetypes by regex; a rule naming an archetype the
    // renderer does not implement would silently fall back for whole families.
    const unknown = SYSTEM_MOTIFS.filter(
      (m) => !SYSTEM_MOTIF_ARCHETYPES.includes(m.archetype),
    ).map((m) => `${m.id}:${m.archetype}`)

    expect(unknown).toEqual([])
  })

  test('every entry has a family for the grouped picker', () => {
    expect(SYSTEM_MOTIFS.filter((m) => !m.family)).toEqual([])
  })

  test('families are small enough to be a usable picker', () => {
    // The whole reason for grouping: a flat 72-row list is not choosable. If a
    // family grows past ~12 it needs splitting, not scrolling.
    const oversized = Object.entries(SYSTEM_MOTIF_FAMILIES)
      .filter(([, rows]) => rows.length > 12)
      .map(([name, rows]) => `${name}:${rows.length}`)

    expect(oversized).toEqual([])
  })

  test('variants are stable and in range', () => {
    // Variant is derived from the id, so a system's glyph must not change
    // between builds — a loading icon that silently redraws itself looks broken.
    for (const motif of SYSTEM_MOTIFS) {
      expect(motif.variant).toBeGreaterThanOrEqual(0)
      expect(motif.variant).toBeLessThan(6)
    }
  })
})

describe('rendering', () => {
  test('every system id renders a glyph', () => {
    for (const motif of SYSTEM_MOTIFS) {
      const { container, unmount } = render(<LoadingMotif motifId={motif.id} />)
      expect(container.querySelector('svg')).not.toBeNull()
      unmount()
    }
  })

  test('system ids normalize as valid picks', () => {
    expect(normalizeLoadingMotifId('nes')).toBe('nes')
    expect(normalizeLoadingMotifId('PSX')).toBe('psx')
    expect(normalizeLoadingMotifId('not-a-system')).toBe(null)
  })

  test('the six base motifs still resolve alongside the system set', () => {
    // Adding 72 ids must not shadow the archetype-free originals.
    for (const id of ['dpad', 'disc', 'stick', 'handheld', 'cart', 'crt']) {
      expect(normalizeLoadingMotifId(id)).toBe(id)
    }
  })
})
