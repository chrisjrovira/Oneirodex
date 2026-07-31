import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DupeGlance } from './DupeGlance'
import { getJson, postJson } from './adminApi'

vi.mock('./adminApi', () => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
}))

beforeEach(() => {
  getJson.mockReset()
  postJson.mockReset()
  getJson.mockResolvedValue([
    {
      id: 1,
      folder_path: '/games/Celeste',
      status: 'Duplicate',
      library_name: 'PC',
      platform_name: 'PCWIN',
      library_uuid: 'lib-1',
      platform_id: 6,
      match_reason: 'Same IGDB id as existing title',
    },
    {
      id: 2,
      folder_path: '/games/3DSenVR',
      status: 'Unmatched',
      library_name: 'PC',
      platform_name: 'PCWIN',
      library_uuid: 'lib-1',
      platform_id: 6,
    },
  ])
  postJson.mockResolvedValue({ changed_count: 1, kept_count: 0 })
})

test('DupeGlance lists duplicates, match reason, and open-path callback', async () => {
  const user = userEvent.setup()
  const onOpenPath = vi.fn()
  render(<DupeGlance onOpenPath={onOpenPath} />)

  expect(await screen.findByRole('heading', { name: 'Dupe glance' })).toBeInTheDocument()
  expect(screen.getByText('/games/Celeste')).toBeInTheDocument()
  expect(screen.getByText('Same IGDB id as existing title')).toBeInTheDocument()
  expect(screen.queryByText('/games/3DSenVR')).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Open path' }))
  expect(onOpenPath).toHaveBeenCalledWith(
    expect.objectContaining({
      path: '/games/Celeste',
      matchReason: 'Same IGDB id as existing title',
    }),
  )
})

test('DupeGlance surfaces fix log success from reclassify', async () => {
  const user = userEvent.setup()
  render(<DupeGlance onOpenPath={() => {}} />)

  await screen.findByRole('heading', { name: 'Dupe glance' })
  await user.click(screen.getByRole('button', { name: 'Fix false duplicates' }))

  await waitFor(() => {
    expect(postJson).toHaveBeenCalledWith('/api/unmatched_folders/reclassify_duplicates', {})
  })
  expect(await screen.findByText(/Reclassified 1 · kept 0 as duplicate/i)).toBeInTheDocument()
})

test('DupeGlance Mark as Emulator calls mark_kind and catalogs without IGDB', async () => {
  const user = userEvent.setup()
  postJson.mockImplementation(async (url) => {
    if (String(url).includes('mark_kind')) {
      return { ok: true, name: '3DSenVR', item_kind: 'emulator', game_uuid: 'g-1' }
    }
    return { changed_count: 0, kept_count: 0 }
  })
  getJson
    .mockResolvedValueOnce([
      {
        id: 2,
        folder_path: '/games/3DSenVR',
        status: 'Unmatched',
        library_name: 'PC',
        platform_name: 'PCWIN',
      },
    ])
    .mockResolvedValueOnce([])

  render(<DupeGlance onOpenPath={() => {}} />)

  await screen.findByRole('heading', { name: 'Dupe glance' })
  await user.selectOptions(screen.getByLabelText(/status/i), 'Unmatched')
  expect(await screen.findByText('/games/3DSenVR')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Identify as game' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Mark as Emulator' }))

  await waitFor(() => {
    expect(postJson).toHaveBeenCalledWith('/api/unmatched_folders/2/mark_kind', {
      item_kind: 'emulator',
      name: '3DSenVR',
    })
  })
  expect(
    await screen.findByText(/Cataloged “3DSenVR” as Emulator \(no IGDB game match\)/i),
  ).toBeInTheDocument()
})

test('DupeGlance shows honest error when mark_kind fails', async () => {
  const user = userEvent.setup()
  getJson.mockResolvedValue([
    {
      id: 9,
      folder_path: '/games/SomeTool',
      status: 'Unmatched',
      library_name: 'PC',
      platform_name: 'PCWIN',
    },
  ])
  postJson.mockRejectedValue(new Error('Unmatched folder not found'))

  render(<DupeGlance onOpenPath={() => {}} />)
  await screen.findByRole('heading', { name: 'Dupe glance' })
  await user.selectOptions(screen.getByLabelText(/status/i), 'Unmatched')
  await user.click(await screen.findByRole('button', { name: 'Mark as Tool' }))

  expect(await screen.findByText(/Unmatched folder not found/i)).toBeInTheDocument()
})

test('DupeGlance shows suggested_kind chip and pre-biases Mark as… when present', async () => {
  const user = userEvent.setup()
  getJson.mockResolvedValue([
    {
      id: 7,
      folder_path: '/games/3DSenVR',
      status: 'Unmatched',
      library_name: 'PC',
      platform_name: 'PCWIN',
      suggested_kind: 'emulator',
    },
  ])

  render(<DupeGlance onOpenPath={() => {}} />)
  await screen.findByRole('heading', { name: 'Dupe glance' })
  await user.selectOptions(screen.getByLabelText(/status/i), 'Unmatched')

  expect(await screen.findByText(/Suggested Emulator/i)).toBeInTheDocument()
  const markButtons = screen.getAllByRole('button', { name: /Mark as /i })
  expect(markButtons[0]).toHaveTextContent('Mark as Emulator')
  expect(markButtons[0].className).toMatch(/is-suggested/)
})

test('DupeGlance tolerates missing suggested_kind without crashing', async () => {
  const user = userEvent.setup()
  getJson.mockResolvedValue([
    {
      id: 8,
      folder_path: '/games/PlainFolder',
      status: 'Unmatched',
      library_name: 'PC',
      platform_name: 'PCWIN',
      suggested_kind: null,
    },
  ])

  render(<DupeGlance onOpenPath={() => {}} />)
  await user.selectOptions(screen.getByLabelText(/status/i), 'Unmatched')
  expect(await screen.findByText('/games/PlainFolder')).toBeInTheDocument()
  expect(screen.queryByText(/Suggested /i)).not.toBeInTheDocument()
})

test('DupeGlance shows match_score beside Why unmatched? when present', async () => {
  const user = userEvent.setup()
  getJson.mockResolvedValue([
    {
      id: 14,
      folder_path: '/games/ScoredMiss',
      status: 'Unmatched',
      library_name: 'PC',
      platform_name: 'PCWIN',
      why_unmatched: 'Title below auto-match threshold.',
      match_score: 0.42,
      suggested_kind: null,
    },
  ])

  render(<DupeGlance onOpenPath={() => {}} />)
  await user.selectOptions(screen.getByLabelText(/status/i), 'Unmatched')
  expect(await screen.findByText(/Why unmatched\?/i)).toBeInTheDocument()
  expect(screen.getByTitle('Match confidence score')).toHaveTextContent('0.42')
  expect(screen.getByText(/Title below auto-match threshold\./i)).toBeInTheDocument()
})

test('DupeGlance omits match_score chip when null', async () => {
  const user = userEvent.setup()
  getJson.mockResolvedValue([
    {
      id: 15,
      folder_path: '/games/NoScore',
      status: 'Unmatched',
      library_name: 'PC',
      platform_name: 'PCWIN',
      why_unmatched: 'No candidates.',
      match_score: null,
    },
  ])

  render(<DupeGlance onOpenPath={() => {}} />)
  await user.selectOptions(screen.getByLabelText(/status/i), 'Unmatched')
  expect(await screen.findByText(/Why unmatched\?/i)).toBeInTheDocument()
  expect(screen.queryByTitle('Match confidence score')).not.toBeInTheDocument()
})

test('DupeGlance shows Why unmatched? from why_unmatched when present', async () => {
  const user = userEvent.setup()
  getJson.mockResolvedValue([
    {
      id: 11,
      folder_path: '/games/MysterySoft',
      status: 'Unmatched',
      library_name: 'PC',
      platform_name: 'PCWIN',
      why_unmatched: 'No IGDB hit; Steam software candidate looks like an emulator.',
      suggested_kind: 'emulator',
    },
  ])

  render(<DupeGlance onOpenPath={() => {}} />)
  await user.selectOptions(screen.getByLabelText(/status/i), 'Unmatched')
  expect(await screen.findByText(/Why unmatched\?/i)).toBeInTheDocument()
  expect(
    screen.getByText(/No IGDB hit; Steam software candidate looks like an emulator\./i),
  ).toBeInTheDocument()
  expect(screen.getByText(/Suggested Emulator/i)).toBeInTheDocument()
})

test('DupeGlance builds Why unmatched? from match_reason + suggested_kind when summary absent', async () => {
  const user = userEvent.setup()
  getJson.mockResolvedValue([
    {
      id: 12,
      folder_path: '/games/NearMiss',
      status: 'Unmatched',
      library_name: 'PC',
      platform_name: 'PCWIN',
      match_reason: 'title_below_threshold',
      suggested_kind: null,
      why_unmatched: null,
    },
  ])

  render(<DupeGlance onOpenPath={() => {}} />)
  await user.selectOptions(screen.getByLabelText(/status/i), 'Unmatched')
  expect(await screen.findByText(/Why unmatched\?/i)).toBeInTheDocument()
  expect(
    screen.getByText(/folder title differs too much to auto-mark as duplicate/i),
  ).toBeInTheDocument()
})

test('DupeGlance tolerates null why fields without crashing', async () => {
  const user = userEvent.setup()
  getJson.mockResolvedValue([
    {
      id: 13,
      folder_path: '/games/EmptyWhy',
      status: 'Unmatched',
      library_name: 'PC',
      platform_name: 'PCWIN',
      match_reason: null,
      why_unmatched: null,
      suggested_kind: null,
    },
  ])

  render(<DupeGlance onOpenPath={() => {}} />)
  await user.selectOptions(screen.getByLabelText(/status/i), 'Unmatched')
  expect(await screen.findByText('/games/EmptyWhy')).toBeInTheDocument()
  expect(screen.getByText(/Why unmatched\?/i)).toBeInTheDocument()
  expect(screen.getByText(/Could not auto-match to IGDB/i)).toBeInTheDocument()
})

test('DupeGlance Backfill kind hints confirms then posts and shows count', async () => {
  const user = userEvent.setup()
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  postJson.mockImplementation(async (url) => {
    if (String(url).includes('backfill_suggested_kind')) {
      return { ok: true, scanned: 12, updated: 4, skipped_no_sidecar: 7, skipped_empty_hint: 1 }
    }
    return { changed_count: 0, kept_count: 0 }
  })

  render(<DupeGlance onOpenPath={() => {}} />)
  await screen.findByRole('heading', { name: 'Dupe glance' })
  await user.click(screen.getByRole('button', { name: 'Backfill kind hints' }))

  expect(confirmSpy).toHaveBeenCalled()
  await waitFor(() => {
    expect(postJson).toHaveBeenCalledWith('/api/unmatched_folders/backfill_suggested_kind', {})
  })
  expect(
    await screen.findByText(/Kind hints updated 4 of 12 scanned · 7 without proposal/i),
  ).toBeInTheDocument()
  confirmSpy.mockRestore()
})

test('DupeGlance Backfill kind hints aborts when confirm is cancelled', async () => {
  const user = userEvent.setup()
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

  render(<DupeGlance onOpenPath={() => {}} />)
  await screen.findByRole('heading', { name: 'Dupe glance' })
  await user.click(screen.getByRole('button', { name: 'Backfill kind hints' }))

  expect(postJson).not.toHaveBeenCalledWith(
    '/api/unmatched_folders/backfill_suggested_kind',
    expect.anything(),
  )
  confirmSpy.mockRestore()
})
