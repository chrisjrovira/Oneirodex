import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DownloadsPage } from './DownloadsPage'
import * as downloadsApi from '../api/downloads'

vi.mock('../api/downloads', () => ({
  fetchMyDownloads: vi.fn(),
  checkStatus: vi.fn(),
  deleteDownload: vi.fn(),
}))

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  downloadsApi.fetchMyDownloads.mockReset()
  downloadsApi.checkStatus.mockReset()
  downloadsApi.deleteDownload.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

test('shows empty state when there are no downloads', async () => {
  downloadsApi.fetchMyDownloads.mockResolvedValue([])

  render(<DownloadsPage />)

  expect(screen.getByText(/Loading downloads/)).toBeInTheDocument()
  expect(await screen.findByText('You have no downloads yet.')).toBeInTheDocument()
})

test('lists downloads and polls non-terminal rows every 5s', async () => {
  downloadsApi.fetchMyDownloads.mockResolvedValue([
    {
      id: 7,
      game_name: 'Pending Game',
      status: 'pending',
      file_name: 'pending.zip',
      download_url: null,
    },
    {
      id: 8,
      game_name: 'Ready Game',
      status: 'available',
      file_name: 'ready.zip',
      download_url: '/download_zip/8',
    },
  ])
  downloadsApi.checkStatus.mockResolvedValue({
    status: 'available',
    downloadId: 7,
    found: true,
  })

  render(<DownloadsPage />)

  expect(await screen.findByText('Pending Game')).toBeInTheDocument()
  expect(screen.getByText('Ready Game')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
    'href',
    '/download_zip/8',
  )

  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000)
  })

  await waitFor(() => {
    expect(downloadsApi.checkStatus).toHaveBeenCalledWith(7)
  })
  expect(downloadsApi.checkStatus).not.toHaveBeenCalledWith(8)

  await waitFor(() => {
    expect(screen.getAllByRole('link', { name: 'Download' })).toHaveLength(2)
  })
  expect(
    document.querySelector('[data-download-id="7"] [data-status]').getAttribute('data-status'),
  ).toBe('available')
  expect(document.querySelector('[data-download-id="7"] a').getAttribute('href')).toBe(
    '/download_zip/7',
  )
})

test('shows error with retry', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  downloadsApi.fetchMyDownloads
    .mockRejectedValueOnce(new Error('boom'))
    .mockResolvedValueOnce([])

  render(<DownloadsPage />)

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load downloads.')
  await user.click(screen.getByRole('button', { name: /Try again/i }))
  expect(await screen.findByText('You have no downloads yet.')).toBeInTheDocument()
})

test('deletes a download row', async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  downloadsApi.fetchMyDownloads.mockResolvedValue([
    {
      id: 3,
      game_name: 'Removable Game',
      status: 'available',
      file_name: 'gone.zip',
      download_url: '/download_zip/3',
    },
  ])
  downloadsApi.deleteDownload.mockResolvedValue(true)

  render(<DownloadsPage />)

  expect(await screen.findByText('Removable Game')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Delete' }))

  await waitFor(() => {
    expect(downloadsApi.deleteDownload).toHaveBeenCalledWith(3)
  })
  expect(screen.queryByText('Removable Game')).not.toBeInTheDocument()
})
