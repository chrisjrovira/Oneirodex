import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaginationBar, PER_PAGE_OPTIONS } from './PaginationBar'

test('PaginationBar exposes 20–1000 page size options including Wave 1 large sizes', () => {
  expect(PER_PAGE_OPTIONS).toEqual([20, 50, 100, 200, 300, 400, 500, 1000])
  render(
    <PaginationBar
      page={1}
      pages={3}
      perPage={20}
      onPageChange={() => {}}
      onPerPageChange={() => {}}
    />,
  )
  const select = screen.getByLabelText('Per page')
  for (const size of [20, 50, 100, 200, 300, 400, 500, 1000]) {
    expect(select).toContainHTML(`value="${size}"`)
  }
})

test('PaginationBar notifies on page size change', async () => {
  const user = userEvent.setup()
  const onPerPageChange = vi.fn()
  render(
    <PaginationBar
      page={1}
      pages={2}
      perPage={50}
      onPageChange={() => {}}
      onPerPageChange={onPerPageChange}
    />,
  )
  await user.selectOptions(screen.getByLabelText('Per page'), '500')
  expect(onPerPageChange).toHaveBeenCalledWith(500)
})
