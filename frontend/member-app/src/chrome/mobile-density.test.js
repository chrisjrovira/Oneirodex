/**
 * Smoke: mobile density rules target library chrome at ≤900px.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(root, 'mobile-density.css'), 'utf8')

describe('mobile-density.css', () => {
  it('stacks filters and pagination under 900px', () => {
    expect(css).toContain('@media (max-width: 900px)')
    expect(css).toContain('.library-filters')
    expect(css).toContain('.gt-pagination')
    expect(css).toContain('.gt-chat-composer')
  })
})
