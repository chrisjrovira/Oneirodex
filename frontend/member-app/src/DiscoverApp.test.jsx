import { render, screen, waitFor } from '@testing-library/react'
import { DiscoverApp } from './DiscoverApp'

function mockDiscoverFetch(sections) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    headers: {
      get(name) {
        return String(name).toLowerCase() === 'content-type' ? 'application/json' : null
      },
    },
    json: async () => ({ sections }),
  })
}

test('renders discover section titles and games as scrollable shelves', async () => {
  mockDiscoverFetch([
    {
      identifier: 'latest_games',
      title: 'Latest Games',
      games: [
        {
          uuid: 'discover-1',
          name: 'Discover VR Game',
          cover_url: '/static/library/images/discover.jpg',
          is_favorite: false,
          has_local_override: true,
          is_vr: true,
          genres: ['Adventure'],
        },
      ],
    },
    {
      identifier: 'highest_rated',
      title: 'Highest Rated',
      games: [
        {
          uuid: 'discover-2',
          name: 'Top Game',
          cover_url: '/static/newstyle/default_cover.jpg',
          is_favorite: true,
          has_local_override: false,
          is_vr: false,
          genres: [],
        },
      ],
    },
  ])

  render(<DiscoverApp isAdmin={false} />)

  expect(await screen.findByRole('heading', { name: 'Latest Games' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Highest Rated' })).toBeInTheDocument()
  expect(document.querySelectorAll('.gt-shelf__track')).toHaveLength(2)
  expect(screen.getByRole('img', { name: 'Discover VR Game' })).toHaveAttribute(
    'src',
    '/static/library/images/discover.jpg',
  )
  expect(screen.getByTitle('Uses local metadata or images')).toBeInTheDocument()
  expect(screen.getByTitle('Virtual Reality')).toBeInTheDocument()
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/discover/sections',
    expect.objectContaining({ credentials: 'same-origin' }),
  )
})

test('does not render empty discover sections', async () => {
  mockDiscoverFetch([
    {
      identifier: 'most_favorited',
      title: 'Most Favorited Games',
      games: [],
    },
  ])

  render(<DiscoverApp isAdmin={false} />)

  await waitFor(() => {
    expect(screen.getByText(/No Discover shelves/i)).toBeInTheDocument()
  })
  expect(screen.queryByRole('heading', { name: 'Most Favorited Games' })).not.toBeInTheDocument()
  expect(document.querySelector('.gt-shelf__track')).not.toBeInTheDocument()
})

test('shows Loading Discover while sections fetch', async () => {
  let resolveFetch
  global.fetch = vi.fn(
    () =>
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
  )

  render(<DiscoverApp isAdmin={false} />)
  expect(screen.getByText('Loading Discover…')).toBeInTheDocument()

  resolveFetch({
    ok: true,
    headers: {
      get(name) {
        return String(name).toLowerCase() === 'content-type' ? 'application/json' : null
      },
    },
    json: async () => ({ sections: [] }),
  })

  await waitFor(() => {
    expect(screen.getByText(/No Discover shelves/i)).toBeInTheDocument()
  })
})
