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
      onWishlistRemove={() => {}}
      onPlayStatus={() => {}}
      onClear={() => {}}
      {...props}
    />,
  )
}

test('renders selection count and batch actions', () => {
  renderBar()

  expect(screen.getByRole('button', { name: /3 selected/i })).toBeEnabled()
  expect(screen.getByRole('button', { name: /Select page/i })).toBeEnabled()
  expect(screen.getByRole('button', { name: /^Favorite$/i })).toBeEnabled()
  expect(screen.queryByRole('button', { name: /^Unfavorite$/i })).toBeNull()
  expect(screen.getByRole('button', { name: /Add to wishlist/i })).toBeEnabled()
  expect(screen.getByRole('button', { name: /Play status/i })).toBeEnabled()
  expect(screen.queryByRole('button', { name: /Clear selection/i })).toBeNull()
})

test('toggles Favorite label from selection state', () => {
  renderBar({ favoriteMode: 'remove' })
  expect(screen.getByRole('button', { name: /^Unfavorite$/i })).toBeEnabled()
  expect(screen.queryByRole('button', { name: /^Favorite$/i })).toBeNull()
})

test('toggles Wishlist label from selection state', () => {
  renderBar({ wishlistMode: 'remove' })
  expect(screen.getByRole('button', { name: /Remove from wishlist/i })).toBeEnabled()
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

test('freshness stays enabled now that bulk route is live', async () => {
  const user = userEvent.setup()
  renderBar({ count: 2 })

  await user.click(screen.getByRole('button', { name: /^More$/i }))
  const freshness = screen.getByRole('button', { name: /Refresh freshness/i })
  expect(freshness).toBeEnabled()
  expect(freshness).toHaveAttribute(
    'title',
    expect.stringMatching(/store freshness/i),
  )
})

test('disables wishlist play status and refresh covers when routes unavailable', async () => {
  const user = userEvent.setup()
  renderBar({
    count: 2,
    wishlistAvailable: false,
    playStatusAvailable: false,
    refreshImagesAvailable: false,
  })

  const wishlist = screen.getByRole('button', { name: /Add to wishlist/i })
  expect(wishlist).toBeDisabled()
  expect(wishlist).toHaveAttribute('title', expect.stringMatching(/not available/i))

  const status = screen.getByRole('button', { name: /Play status/i })
  expect(status).toBeDisabled()
  expect(status).toHaveAttribute('title', expect.stringMatching(/not available/i))

  await user.click(screen.getByRole('button', { name: /^More$/i }))
  const covers = screen.getByRole('button', { name: /Refresh covers/i })
  expect(covers).toBeDisabled()
  expect(covers).toHaveAttribute('title', expect.stringMatching(/not available/i))
})

test('invokes Favorite Wishlist and count-as-clear handlers', async () => {
  const user = userEvent.setup()
  const onFavorite = vi.fn()
  const onUnfavorite = vi.fn()
  const onSelectPage = vi.fn()
  const onWishlist = vi.fn()
  const onWishlistRemove = vi.fn()
  const onClear = vi.fn()

  renderBar({
    count: 1,
    onFavorite,
    onUnfavorite,
    onSelectPage,
    onWishlist,
    onWishlistRemove,
    onClear,
  })

  await user.click(screen.getByRole('button', { name: /Select page/i }))
  await user.click(screen.getByRole('button', { name: /^Favorite$/i }))
  await user.click(screen.getByRole('button', { name: /Add to wishlist/i }))
  await user.click(screen.getByRole('button', { name: /1 selected/i }))

  expect(onSelectPage).toHaveBeenCalledTimes(1)
  expect(onFavorite).toHaveBeenCalledTimes(1)
  expect(onWishlist).toHaveBeenCalledTimes(1)
  expect(onClear).toHaveBeenCalledTimes(1)
  expect(onUnfavorite).not.toHaveBeenCalled()
  expect(onWishlistRemove).not.toHaveBeenCalled()
})

test('remove modes call the remove handlers', async () => {
  const user = userEvent.setup()
  const onUnfavorite = vi.fn()
  const onWishlistRemove = vi.fn()
  renderBar({
    count: 2,
    favoriteMode: 'remove',
    wishlistMode: 'remove',
    onUnfavorite,
    onWishlistRemove,
  })
  await user.click(screen.getByRole('button', { name: /^Unfavorite$/i }))
  await user.click(screen.getByRole('button', { name: /Remove from wishlist/i }))
  expect(onUnfavorite).toHaveBeenCalledTimes(1)
  expect(onWishlistRemove).toHaveBeenCalledTimes(1)
})
