import { render, screen } from '@testing-library/react'
// Module scope, not inside the test: see SpaceRail.test.jsx — an in-test
// dynamic import puts the module's first transform inside the timeout.
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import { ReportIssuePage } from './ReportIssuePage'

test('keeps logs and context collapsed by default', () => {
  render(
    <MemoryRouter>
      <ReportIssuePage />
    </MemoryRouter>,
  )

  expect(screen.getByRole('heading', { name: 'Report issue' })).toBeInTheDocument()
  expect(screen.getByLabelText('Title')).toBeInTheDocument()
  expect(screen.getByLabelText('Symptom')).toBeInTheDocument()

  const logsFold = screen.getByText('Logs & extras (optional)').closest('details')
  const contextFold = screen.getByText('Context (deploy, client, URL)').closest('details')
  expect(logsFold).toBeTruthy()
  expect(contextFold).toBeTruthy()
  expect(logsFold.open).toBe(false)
  expect(contextFold.open).toBe(false)

  expect(screen.queryByPlaceholderText('Paste only the relevant lines')).not.toBeInTheDocument()
})

test('expands logs fold when opened', async () => {
  const user = userEvent.setup()

  render(
    <MemoryRouter>
      <ReportIssuePage />
    </MemoryRouter>,
  )

  await user.click(screen.getByText('Logs & extras (optional)'))
  expect(screen.getByPlaceholderText('Paste only the relevant lines')).toBeInTheDocument()
})
