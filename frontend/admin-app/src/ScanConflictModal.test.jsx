import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { ScanConflictModal } from './ScanConflictModal'
import { SCAN_QUEUE_POLICY } from './scanQueuePolicy'

describe('ScanConflictModal', () => {
  test('offers Queue (default focus) and Force with NAS warning', async () => {
    const user = userEvent.setup()
    const onChoose = vi.fn()
    const onClose = vi.fn()
    render(<ScanConflictModal open onChoose={onChoose} onClose={onClose} />)

    expect(screen.getByRole('heading', { name: /scan in progress/i })).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(/Unraid\/NAS/i)

    const queueBtn = screen.getByRole('button', { name: /queue this scan/i })
    expect(queueBtn).toHaveFocus()
    await user.click(queueBtn)
    expect(onChoose).toHaveBeenCalledWith(SCAN_QUEUE_POLICY.QUEUE)

    await user.click(screen.getByRole('button', { name: /force run now/i }))
    expect(onChoose).toHaveBeenCalledWith(SCAN_QUEUE_POLICY.FORCE)
  })

  test('Cancel closes without choosing a policy', async () => {
    const user = userEvent.setup()
    const onChoose = vi.fn()
    const onClose = vi.fn()
    render(<ScanConflictModal open onChoose={onChoose} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onClose).toHaveBeenCalled()
    expect(onChoose).not.toHaveBeenCalled()
  })

  test('busy disables Queue / Force / Cancel', () => {
    render(
      <ScanConflictModal open busy onChoose={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: /queue this scan/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /force run now/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeDisabled()
  })
})
