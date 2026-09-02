import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { getJson, postJsonResult } from './adminApi'
import { LibrariesPanel } from './LibrariesPanel'

vi.mock('./adminApi', () => ({
  getJson: vi.fn(),
  postJsonResult: vi.fn(),
}))

vi.mock('./useLibraryScan', () => ({
  useLibraryScan: () => ({
    conflictOpen: false,
    busyKey: null,
    startScan: vi.fn(),
    onConflictChoose: vi.fn(),
    onConflictClose: vi.fn(),
  }),
}))

vi.mock('./utils/toast', () => ({
  showToast: vi.fn(),
}))

const ROWS = [
  {
    uuid: 'a',
    name: '_pc',
    platform: 'PC Windows',
    platform_key: 'PCWIN',
    game_count: 1640,
    unmatched_count: 12,
    platform_total: null,
    group_name: null,
    image_url: '',
    last_scan_folder: '/storage/_pc',
  },
  {
    uuid: 'b',
    name: 'NES',
    platform: 'Nintendo Entertainment System (NES)',
    platform_key: 'NES',
    game_count: 0,
    unmatched_count: 3,
    platform_total: 200,
    group_name: null,
    image_url: '',
    last_scan_folder: '/storage/nes',
  },
  {
    uuid: 'c',
    name: 'SNES',
    platform: 'Super Nintendo Entertainment System (SNES)',
    platform_key: 'SNES',
    game_count: 200,
    unmatched_count: 0,
    platform_total: 200,
    group_name: 'Consoles',
    image_url: '',
    last_scan_folder: '/storage/snes',
  },
]

beforeEach(() => {
  getJson.mockReset()
  postJsonResult.mockReset()
  getJson.mockResolvedValue(ROWS)
  postJsonResult.mockResolvedValue({ ok: true, data: { ok: true } })
  document.getElementById('od-admin-topbar-trail')?.remove()
  const trail = document.createElement('div')
  trail.id = 'od-admin-topbar-trail'
  document.body.appendChild(trail)
  try {
    window.sessionStorage?.clear()
  } catch {
    /* ignore */
  }
})

test('hides selected copy until a row is checked', async () => {
  render(<LibrariesPanel />)
  await screen.findByText('_pc')
  expect(screen.queryByText('0 selected')).toBeNull()
})

test('libraries count lives in the topbar trail and opens a platform filter menu', async () => {
  try {
    window.sessionStorage?.setItem('od-libraries-catalog-refresh-v1', '1')
  } catch {
    /* ignore */
  }
  render(<LibrariesPanel />)
  await screen.findByText('_pc')
  const trigger = await screen.findByRole('button', { name: /3 libraries/i })
  await waitFor(() => {
    expect(document.getElementById('od-admin-topbar-trail')?.contains(trigger)).toBe(true)
  })
  fireEvent.click(trigger)
  expect(screen.getByText(/1840 games/i)).toBeTruthy()
  expect(screen.getByText(/15 unmatched/i)).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Filter by platform'), {
    target: { value: 'nintendo entertainment system' },
  })
  const dialog = screen.getByRole('dialog', { name: 'Libraries summary' })
  expect(within(dialog).getByText('Nintendo Entertainment System (NES)')).toBeTruthy()
  expect(within(dialog).queryByText('PC Windows')).toBeNull()
  fireEvent.click(within(dialog).getByText('Nintendo Entertainment System (NES)'))
  await waitFor(() => {
    expect(screen.queryByText('_pc')).toBeNull()
  })
  expect(screen.getByText('NES')).toBeTruthy()
})

test('group column is present only when a library is grouped', async () => {
  render(<LibrariesPanel />)
  await screen.findByText('Consoles')
  expect(screen.getByRole('columnheader', { name: /Group/i })).toBeTruthy()
})

test('group column is omitted when nothing is grouped', async () => {
  getJson.mockResolvedValue(ROWS.map((row) => ({ ...row, group_name: null })))
  render(<LibrariesPanel />)
  await screen.findByText('_pc')
  expect(screen.queryByRole('columnheader', { name: /Group/i })).toBeNull()
})

test('row Group opens a dialog and posts group_name', async () => {
  render(<LibrariesPanel />)
  await screen.findByText('_pc')
  const row = screen.getByRole('row', { name: /_pc/i })
  fireEvent.click(within(row).getByRole('button', { name: 'Group' }))
  fireEvent.change(screen.getByPlaceholderText('e.g. Arcade cabinets'), {
    target: { value: 'PC' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => {
    expect(postJsonResult).toHaveBeenCalledWith(
      '/api/admin/libraries/batch/edit',
      expect.objectContaining({
        library_uuids: ['a'],
        group_name: 'PC',
      }),
    )
  })
})

test('colors game counts when a platform total is known', async () => {
  try {
    window.sessionStorage?.setItem('od-libraries-catalog-refresh-v1', '1')
  } catch {
    /* ignore */
  }
  render(<LibrariesPanel />)
  await screen.findByText('SNES')
  const full = screen.getByTitle('200 of 200 released')
  const empty = screen.getByTitle('0 of 200 released')
  // jsdom may serialize hsl() as rgb(); assert the computed green/red channel.
  expect(full.style.color).toBeTruthy()
  expect(empty.style.color).toBeTruthy()
  expect(full.style.color).not.toEqual(empty.style.color)
})
