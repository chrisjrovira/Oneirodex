import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AcquirePage } from './AcquirePage'
import * as updatesApi from '../api/updates'

vi.mock('../api/updates', () => ({
  fetchAcquireStatus: vi.fn(),
  searchAcquire: vi.fn(),
}))

vi.mock('../utils/toast', () => ({
  showToast: vi.fn(),
}))

const READY_STATUS = {
  enabled: true,
  arr_enabled: true,
  debrid_enabled: false,
  can_send: true,
  clients: [],
  indexers_ready: true,
}

test('failed status uses PageStatus with Retry and does not look like the module is off', async () => {
  const user = userEvent.setup()
  let failStatus = true
  updatesApi.fetchAcquireStatus.mockImplementation(() => {
    if (failStatus) {
      return Promise.reject(new Error('Unable to load Acquire.'))
    }
    return Promise.resolve(READY_STATUS)
  })

  render(<AcquirePage />)

  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load Acquire.')
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  expect(screen.queryByText(/Enable ENABLE_ARR_MODULE/)).not.toBeInTheDocument()

  failStatus = false
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText(/Arr: on/)).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
