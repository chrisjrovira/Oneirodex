import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SystemBackdrop } from './SystemBackdrop'

describe('SystemBackdrop', () => {
  it('renders nothing when no system is selected', () => {
    const { container } = render(<SystemBackdrop platform={null} label="" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when a platform has no usable name', () => {
    // A blank backdrop is worse than none — it would still tint the page.
    const { container } = render(<SystemBackdrop platform="" label="   " />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the system name as the artwork', () => {
    render(<SystemBackdrop platform="SNES" label="Super Nintendo" />)
    expect(screen.getByText('Super Nintendo')).toBeInTheDocument()
  })

  it('falls back to the platform id when no label came back with the rows', () => {
    render(<SystemBackdrop platform="SNES" label="" />)
    expect(screen.getByText('SNES')).toBeInTheDocument()
  })

  it('tags the play room so the backdrop can follow the era setting', () => {
    const { container } = render(<SystemBackdrop platform="SNES" label="Super NES" />)
    expect(
      container.querySelector('[data-play-room="teen_bedroom_90s"]'),
    ).not.toBeNull()
    expect(container.querySelector('.gt-system-backdrop__wall')).not.toBeNull()
  })

  it('tags the console family so CSS can tint it', () => {
    const { container } = render(<SystemBackdrop platform="PSX" label="PlayStation" />)
    expect(
      container.querySelector('[data-backdrop-family="sony"]'),
    ).not.toBeNull()
  })

  it('is hidden from assistive tech — it is decoration, not content', () => {
    const { container } = render(<SystemBackdrop platform="NES" label="NES" />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('never intercepts pointer input meant for the grid', () => {
    const { container } = render(<SystemBackdrop platform="NES" label="NES" />)
    // The class carries pointer-events:none; assert it is applied so a refactor
    // that renames it fails here rather than silently blocking tile clicks.
    expect(container.firstChild).toHaveClass('gt-system-backdrop')
  })
})
