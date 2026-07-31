import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LibrarySelectionBar } from './LibrarySelectionBar'

function renderBar(props = {}) {
  return render(
    <LibrarySelectionBar
      count={3}
      onFavorite={() => {}}
      onUnfavorite={() => {}}
      onRefreshFreshness={() => {}}
      onRefreshImages={() => {}}
      onSelectPage={() => {}}
      onWishlist={() => {}}
      onPlayStatus={() => {}}
      onClear={() => {}}
      {...props}
    />,
  )
}

test('renders selection count and batch actions', () => {
  renderBar()

  expect(screen.getByText('3 selected')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Select page/i })).toBeEnabled()
  expect(screen.getByRole('button', { name: /^Favorite$/i })).toBeEnabled()
  expect(screen.getByRole('button', { name: /^Unfavorite$/i })).toBeEnabled()
  expect(screen.getByRole('button', { name: /Add to wishlist/i })).toBeEnabled()
  expect(screen.getByRole('combobox', { name: /Play status/i })).toBeEnabled()
  expect(screen.getByRole('button', { name: /Refresh freshness/i })).toBeEnabled()
  expect(screen.getByRole('button', { name: /Refresh covers/i })).toBeEnabled()
  expect(screen.getByRole('button', { name: /Clear selection/i })).toBeEnabled()
})

test('hides when selection is empty', () => {
  const { container } = render(
    <LibrarySelectionBar
      count={0}
      onFavorite={() => {}}
      onUnfavorite={() => {}}
      onRefreshFreshness={() => {}}
      onClear={() => {}}
    />,
  )
  expect(container.firstChild).toBeNull()
})

test('freshness stays enabled now that bulk route is live', () => {
  renderBar({ count: 2 })

  const freshness = screen.getByRole('button', { name: /Refresh freshness/i })
  expect(freshness).toBeEnabled()
  expect(freshness).toHaveAttribute(
    'title',
    expect.stringMatching(/store freshness/i),
  )
})

test('disables wishlist play status and refresh covers when routes unavailable', () => {
  renderBar({
    count: 2,
    wishlistAvailable: false,
    playStatusAvailable: false,
    refreshImagesAvailable: false,
  })

  const wishlist = screen.getByRole('button', { name: /Add to wishlist/i })
  expect(wishlist).toBeDisabled()
  expect(wishlist).toHaveAttribute('title', expect.stringMatching(/not available/i))

  const status = screen.getByRole('combobox', { name: /Play status/i })
  expect(status).toBeDisabled()
  expect(status).toHaveAttribute('title', expect.stringMatching(/not available/i))

  const covers = screen.getByRole('button', { name: /Refresh covers/i })
  expect(covers).toBeDisabled()
  expect(covers).toHaveAttribute('title', expect.stringMatching(/not available/i))
})

test('invokes Favorite Unfavorite Select page Wishlist Clear handlers', async () => {
  const user = userEvent.setup()
  const onFavorite = vi.fn()
  const onUnfavorite = vi.fn()
  const onSelectPage = vi.fn()
  const onWishlist = vi.fn()
  const onClear = vi.fn()

  renderBar({
    count: 1,
    onFavorite,
    onUnfavorite,
    onSelectPage,
    onWishlist,
    onClear,
  })

  await user.click(screen.getByRole('button', { name: /Select page/i }))
  await user.click(screen.getByRole('button', { name: /^Favorite$/i }))
  await user.click(screen.getByRole('button', { name: /^Unfavorite$/i }))
  await user.click(screen.getByRole('button', { name: /Add to wishlist/i }))
  await user.click(screen.getByRole('button', { name: /Clear selection/i }))

  expect(onSelectPage).toHaveBeenCalledTimes(1)
  expect(onFavorite).toHaveBeenCalledTimes(1)
  expect(onUnfavorite).toHaveBeenCalledTimes(1)
  expect(onWishlist).toHaveBeenCalledTimes(1)
  expect(onClear).toHaveBeenCalledTimes(1)
})

test('play status select invokes handler with value and clear token', async () => {
  const user = userEvent.setup()
  const onPlayStatus = vi.fn()

  renderBar({ count: 2, onPlayStatus })

  const select = screen.getByRole('combobox', { name: /Play status/i })
  await user.selectOptions(select, 'beaten')
  expect(onPlayStatus).toHaveBeenCalledWith('beaten')

  await user.selectOptions(select, '__clear__')
  expect(onPlayStatus).toHaveBeenCalledWith('')
})

test('Refresh covers button invokes handler', async () => {
  const user = userEvent.setup()
  const onRefreshImages = vi.fn()

  renderBar({ count: 2, onRefreshImages })

  await user.click(screen.getByRole('button', { name: /Refresh covers/i }))
  expect(onRefreshImages).toHaveBeenCalledTimes(1)
})

test('hides Refresh covers when handler omitted', () => {
  renderBar({ count: 2, onRefreshImages: undefined })
  expect(screen.queryByRole('button', { name: /Refresh covers/i })).not.toBeInTheDocument()
})
