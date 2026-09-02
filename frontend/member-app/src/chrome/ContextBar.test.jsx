import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ContextBar, Popover, SegmentedViews } from './ContextBar'

const VIEWS = [
  { id: 'all', label: 'All' },
  { id: 'games', label: 'Games' },
  { id: 'soft', label: 'Soft titles' },
]

describe('SegmentedViews', () => {
  it('renders nothing without views, so a page can omit them', () => {
    const { container } = render(<SegmentedViews views={[]} active="" />)
    expect(container.firstChild).toBeNull()
  })

  it('marks exactly one view pressed', () => {
    render(<SegmentedViews views={VIEWS} active="games" />)
    const pressed = screen.getAllByRole('button').filter(
      (b) => b.getAttribute('aria-pressed') === 'true',
    )
    expect(pressed).toHaveLength(1)
    expect(pressed[0]).toHaveTextContent('Games')
  })

  it('reports the chosen view', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<SegmentedViews views={VIEWS} active="all" onSelect={onSelect} />)
    await user.click(screen.getByRole('button', { name: 'Soft titles' }))
    expect(onSelect).toHaveBeenCalledWith('soft')
  })

  it('names the trigger after the active layout and keeps options behind it', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <SegmentedViews
        views={VIEWS}
        active="all"
        onSelect={() => {}}
        unfurl={{
          views: [
            { id: 'tile', label: 'Tile' },
            { id: 'rows', label: 'Rows' },
            { id: 'grid', label: 'Grid' },
          ],
          active: 'tile',
          onSelect,
          triggerLabel: 'View',
        }}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Tile' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Rows' })).not.toBeInTheDocument()

    await user.click(trigger)
    expect(screen.getByRole('button', { name: 'Tile', expanded: true })).toBeInTheDocument()
    const unfurl = screen.getByRole('group', { name: 'View' })
    expect(unfurl.className).toBe('od-contextbar__views-unfurl')
    expect(unfurl.className).not.toMatch(/\bgt-seg\b/)
    await user.click(screen.getByRole('button', { name: 'Rows' }))
    expect(onSelect).toHaveBeenCalledWith('rows')
    expect(screen.queryByRole('group', { name: 'View' })).not.toBeInTheDocument()
  })
})

describe('Popover', () => {
  it('starts closed', () => {
    render(<Popover label="Filters"><p>panel</p></Popover>)
    expect(screen.queryByText('panel')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Filters/ })).toHaveAttribute(
      'aria-expanded', 'false',
    )
  })

  it('opens and closes from the trigger', async () => {
    const user = userEvent.setup()
    render(<Popover label="Filters"><p>panel</p></Popover>)
    const trigger = screen.getByRole('button', { name: /Filters/ })
    await user.click(trigger)
    expect(screen.getByText('panel')).toBeInTheDocument()
    await user.click(trigger)
    expect(screen.queryByText('panel')).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<Popover label="Filters"><p>panel</p></Popover>)
    await user.click(screen.getByRole('button', { name: /Filters/ }))
    await user.keyboard('{Escape}')
    expect(screen.queryByText('panel')).not.toBeInTheDocument()
  })

  it('closes on an outside click but not an inside one', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <span data-testid="outside">elsewhere</span>
        <Popover label="Filters"><button type="button">Inside</button></Popover>
      </div>,
    )
    await user.click(screen.getByRole('button', { name: /Filters/ }))
    await user.click(screen.getByRole('button', { name: 'Inside' }))
    expect(screen.getByRole('button', { name: 'Inside' })).toBeInTheDocument()
    await user.click(screen.getByTestId('outside'))
    expect(screen.queryByRole('button', { name: 'Inside' })).not.toBeInTheDocument()
  })

  it('shows a count badge when filters are active', () => {
    // The badge is the only thing that keeps a collapsed popover from hiding
    // why the grid looks empty — the plan calls this out as a real risk.
    render(<Popover label="Filters" count={3}><p>panel</p></Popover>)
    const trigger = screen.getByRole('button', { name: /Filters/ })
    expect(trigger).toHaveTextContent('3')
    expect(trigger).toHaveClass('is-on')
  })

  it('shows no badge at zero', () => {
    render(<Popover label="Filters" count={0}><p>panel</p></Popover>)
    const trigger = screen.getByRole('button', { name: /Filters/ })
    expect(trigger).not.toHaveClass('is-on')
    expect(trigger).not.toHaveTextContent('0')
  })
})

describe('ContextBar', () => {
  it('offers exactly one filters control and one overflow', async () => {
    const user = userEvent.setup()
    render(
      <ContextBar
        views={VIEWS}
        activeView="all"
        filters={<p>filter body</p>}
        filterCount={2}
        overflow={<p>overflow body</p>}
        summary="1,284 titles"
      />,
    )
    // Two competing overflow menus is the thing this refresh removes.
    expect(screen.getAllByRole('button', { name: /Filters/ })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: /More/ })).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /Filters/ }))
    expect(screen.getByText('filter body')).toBeInTheDocument()
  })

  it('omits the filters control when a page has no filters', () => {
    render(<ContextBar views={VIEWS} activeView="all" />)
    expect(screen.queryByRole('button', { name: /Filters/ })).not.toBeInTheDocument()
  })

  it('opens Discover row settings from the summary count, not a second Rows button', async () => {
    const user = userEvent.setup()
    render(
      <ContextBar
        filtersOnSummary
        filterCount={1}
        filters={<p>row settings</p>}
        summary="2 rows"
      />,
    )
    expect(screen.queryByRole('button', { name: /^Rows$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Filters/ })).not.toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: /2 rows/ })
    expect(trigger).toHaveClass('od-contextbar__count')
    await user.click(trigger)
    expect(screen.getByText('row settings')).toBeInTheDocument()
  })

  it('keeps a plain summary when filters stay in the lead slot', () => {
    render(
      <ContextBar
        filtersLabel="Rows"
        filterCount={1}
        filters={<p>row settings</p>}
        summary="2 rows"
      />,
    )
    expect(screen.getByRole('button', { name: /Rows/ })).toBeInTheDocument()
    expect(screen.getByText('2 rows').tagName).toBe('SPAN')
  })

  it('shows the summary count', () => {
    render(<ContextBar views={VIEWS} activeView="all" summary="12 libraries" />)
    expect(screen.getByText('12 libraries')).toBeInTheDocument()
  })

  it('carries no page heading — that is the point of the refresh', () => {
    const { container } = render(
      <ContextBar views={VIEWS} activeView="all" summary="1,284 titles" />,
    )
    expect(container.querySelector('h1, h2, h3')).toBeNull()
  })
})

describe('ContextBar portal ownership', () => {
  /**
   * The bug these cover: a page's controls stayed in the top bar after the page
   * was gone. The first ContextBar mounted after login never had its portal
   * torn down, so Activity's "Everyone / Friends only" strip sat in the centre
   * slot on every later page — Library rendered it above its own view strip.
   * Reproduced in a browser, then pinned here.
   */
  function mountSlots() {
    const bar = document.createElement('div')
    for (const id of ['od-topbar-lead', 'od-topbar-slot', 'od-topbar-trail']) {
      const slot = document.createElement('div')
      slot.id = id
      bar.appendChild(slot)
    }
    document.body.appendChild(bar)
    return bar
  }

  function centreText() {
    return (document.getElementById('od-topbar-slot').textContent || '').trim()
  }

  it('renders a page’s views into the top bar rather than inline', () => {
    const bar = mountSlots()
    render(<ContextBar views={VIEWS} activeView="all" />)

    expect(centreText()).toContain('Games')
    bar.remove()
  })

  it('leaves the slot empty when the page unmounts', () => {
    const bar = mountSlots()
    const { unmount } = render(<ContextBar views={VIEWS} activeView="all" />)
    expect(centreText()).toContain('Games')

    unmount()
    expect(centreText()).toBe('')
    expect(document.querySelectorAll('[data-od-contextbar-host]')).toHaveLength(0)
    bar.remove()
  })

  it('evicts another page’s stranded controls instead of stacking under them', () => {
    const bar = mountSlots()

    // Stand in for a portal whose cleanup never ran — the exact state the
    // browser was left in. A new page must clear it, not render beneath it.
    const stranded = document.createElement('div')
    stranded.setAttribute('data-od-contextbar-host', 'gone-page')
    stranded.textContent = 'Everyone Friends only'
    document.getElementById('od-topbar-slot').appendChild(stranded)

    render(<ContextBar views={VIEWS} activeView="all" />)

    expect(centreText()).not.toContain('Everyone')
    expect(centreText()).toContain('Games')
    bar.remove()
  })

  it('falls back to an inline bar when there is no top bar to portal into', () => {
    // Big Picture and the pop-out chat host render the route without chrome.
    const { container } = render(<ContextBar views={VIEWS} activeView="all" />)
    expect(container.querySelector('.od-contextbar')).not.toBeNull()
  })
})
