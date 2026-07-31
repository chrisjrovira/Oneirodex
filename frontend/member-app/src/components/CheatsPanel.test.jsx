import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import * as cheatsApi from '../api/cheats'
import { CheatsPanel } from './CheatsPanel'

vi.mock('../api/cheats', async () => {
  const actual = await vi.importActual('../api/cheats')
  return {
    ...actual,
    listCheats: vi.fn(),
    createCheat: vi.fn(),
    uploadCheat: vi.fn(),
    deleteCheat: vi.fn(),
  }
})

vi.mock('../utils/toast', () => ({
  showToast: vi.fn(),
}))

const GAME_UUID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  cheatsApi.listCheats.mockReset()
  cheatsApi.createCheat.mockReset()
  cheatsApi.uploadCheat.mockReset()
  cheatsApi.deleteCheat.mockReset()
  cheatsApi.listCheats.mockResolvedValue({ game_uuid: GAME_UUID, cheats: [] })
})

function renderPanel(props = {}) {
  return render(
    <MemoryRouter>
      <CheatsPanel gameUuid={GAME_UUID} {...props} />
    </MemoryRouter>,
  )
}

test('create form posts name, dialect, and code rows', async () => {
  const user = userEvent.setup()
  cheatsApi.createCheat.mockResolvedValue({
    name: 'Infinite_lives.cht',
    size: 42,
    url: `/api/games/${GAME_UUID}/cheats/Infinite_lives.cht`,
  })
  cheatsApi.listCheats
    .mockResolvedValueOnce({ game_uuid: GAME_UUID, cheats: [] })
    .mockResolvedValueOnce({
      game_uuid: GAME_UUID,
      cheats: [
        {
          name: 'Infinite_lives.cht',
          size: 42,
          url: `/api/games/${GAME_UUID}/cheats/Infinite_lives.cht`,
        },
      ],
    })

  renderPanel({ playHref: '/static/vendor/webretro/webretro.html?guid=x&core=nestopia' })

  expect(await screen.findByRole('heading', { name: 'Cheats' })).toBeInTheDocument()
  expect(screen.getByText(/create one or upload/i)).toBeInTheDocument()

  await user.type(screen.getByRole('textbox', { name: /^Name$/i }), 'Infinite lives')
  await user.selectOptions(screen.getByRole('combobox', { name: /Dialect hint/i }), 'game_genie')
  await user.type(screen.getByRole('textbox', { name: /^Code$/i }), 'SLXP-1234')
  await user.click(screen.getByRole('button', { name: /Save cheat/i }))

  await waitFor(() => {
    expect(cheatsApi.createCheat).toHaveBeenCalledWith(GAME_UUID, {
      name: 'Infinite lives',
      codes: [{ desc: '', code: 'SLXP-1234' }],
      dialect: 'game_genie',
    })
  })

  expect(await screen.findByText('Infinite_lives.cht')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Play in browser/i })).toHaveAttribute(
    'href',
    '/static/vendor/webretro/webretro.html?guid=x&core=nestopia',
  )
})

test('PC honesty note when library platform is PC native', async () => {
  renderPanel({ libraryPlatform: 'PCWIN' })
  expect(await screen.findByText(/does not inject memory cheats/i)).toBeInTheDocument()
})

test('shows create-unavailable message without toast spam path', async () => {
  const user = userEvent.setup()
  const err = new Error(
    'Easy-create is not available on this server yet. Upload a .cht file, or wait for the create API.',
  )
  err.code = 'create_unavailable'
  cheatsApi.createCheat.mockRejectedValue(err)

  renderPanel()
  await screen.findByRole('heading', { name: 'Cheats' })
  await user.type(screen.getByRole('textbox', { name: /^Name$/i }), 'Test')
  await user.type(screen.getByRole('textbox', { name: /^Code$/i }), 'AAAA')
  await user.click(screen.getByRole('button', { name: /Save cheat/i }))

  expect(await screen.findByRole('alert')).toHaveTextContent(/Easy-create is not available/i)
})
