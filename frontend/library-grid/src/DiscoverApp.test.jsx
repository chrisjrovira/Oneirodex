import { render, screen } from '@testing-library/react'
import { DiscoverApp } from './DiscoverApp'

test('renders discover section titles and games with the shared grid', () => {
  render(
    <DiscoverApp
      sections={[
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
      ]}
      isAdmin={false}
    />,
  )

  expect(screen.getByRole('heading', { name: 'Latest Games' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Highest Rated' })).toBeInTheDocument()
  expect(document.querySelectorAll('[data-library-grid]')).toHaveLength(2)
  expect(screen.getByRole('img', { name: 'Discover VR Game' })).toHaveAttribute(
    'src',
    '/static/library/images/discover.jpg',
  )
  expect(screen.getByTitle('Uses local metadata or images')).toBeInTheDocument()
  expect(screen.getByTitle('Virtual Reality')).toBeInTheDocument()
})

test('does not render empty discover sections', () => {
  render(
    <DiscoverApp
      sections={[
        {
          identifier: 'most_favorited',
          title: 'Most Favorited Games',
          games: [],
        },
      ]}
      isAdmin={false}
    />,
  )

  expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  expect(document.querySelector('[data-library-grid]')).not.toBeInTheDocument()
})
