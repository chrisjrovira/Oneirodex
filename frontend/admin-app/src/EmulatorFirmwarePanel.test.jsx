import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import {
  EmulatorFirmwarePanel,
  coreLabel,
  formatBytes,
} from './EmulatorFirmwarePanel'

const SUMMARY = {
  files: [{ name: 'scph5501.bin', size: 524288 }],
  cores: [
    {
      core: 'mednafen_psx_hw',
      required: ['scph5500.bin', 'scph5501.bin'],
      present: ['scph5501.bin'],
      ready: true,
    },
    { core: 'yabause', required: ['saturn_bios.bin'], present: [], ready: false },
  ],
}

function mockGet(payload = SUMMARY) {
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => payload,
  }))
}

afterEach(() => {
  vi.restoreAllMocks()
})

test('formatBytes is honest about unknown sizes', () => {
  expect(formatBytes(512)).toBe('512 B')
  expect(formatBytes(524288)).toBe('512.0 KB')
  expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB')
  expect(formatBytes(null)).toBe('n/a')
  expect(formatBytes(-1)).toBe('n/a')
})

test('coreLabel maps libretro ids to human names and passes unknowns through', () => {
  expect(coreLabel('mednafen_psx_hw')).toBe('PlayStation')
  expect(coreLabel('some_new_core')).toBe('some_new_core')
})

test('renders coverage, cores and files', async () => {
  mockGet()
  render(<EmulatorFirmwarePanel />)

  expect(await screen.findByText('PlayStation')).toBeInTheDocument()
  expect(screen.getByText('Saturn')).toBeInTheDocument()
  expect(screen.getByText('missing system files')).toBeInTheDocument()
  expect(screen.getByText('scph5501.bin')).toBeInTheDocument()
  expect(screen.getByLabelText('Firmware coverage')).toBeInTheDocument()
})

test('never offers to download BIOS — product stance', async () => {
  mockGet()
  render(<EmulatorFirmwarePanel />)
  await screen.findByText('PlayStation')

  expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /download/i })).not.toBeInTheDocument()
  expect(screen.getByText(/never downloads BIOS for you/i)).toBeInTheDocument()
})

test('empty volume states the play consequence rather than just "none"', async () => {
  mockGet({ files: [], cores: SUMMARY.cores })
  render(<EmulatorFirmwarePanel />)

  expect(
    await screen.findByText(/Cores that need it will stay unavailable for browser play/i),
  ).toBeInTheDocument()
})

test('surfaces the backend rejection message on a failed upload', async () => {
  mockGet()
  render(<EmulatorFirmwarePanel />)
  await screen.findByText('PlayStation')

  global.fetch = vi.fn(async () => ({
    ok: false,
    status: 422,
    json: async () => ({
      ok: false,
      error: 'Unsupported firmware file type ".exe". Allowed: .bin, .rom',
      error_code: 'unprocessable',
    }),
  }))

  const file = new File(['x'], 'bad.exe', { type: 'application/octet-stream' })
  await userEvent.upload(screen.getByLabelText('Firmware file'), file)

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unsupported firmware file type ".exe"',
  )
})

test('read failure offers a retry rather than an empty page', async () => {
  global.fetch = vi.fn(async () => ({
    ok: false,
    status: 500,
    json: async () => ({ error: 'Volume not mounted' }),
  }))
  render(<EmulatorFirmwarePanel />)

  expect(await screen.findByRole('alert')).toHaveTextContent('Volume not mounted')

  mockGet()
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => expect(screen.getByText('PlayStation')).toBeInTheDocument())
})
