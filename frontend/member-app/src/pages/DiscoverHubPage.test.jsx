import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DiscoverHubPage } from './DiscoverHubPage'

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return String(name).toLowerCase() === 'content-type' ? 'application/json' : null
      },
    },
    json: async () => body,
  }
}

function renderHub(path = '/discover/hub/genre/Roguelike') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/discover/hub/genre/:genre" element={<DiscoverHubPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

test('renders hub shelves without pin or hide', async () => {
  global.fetch = vi.fn(() =>
    Promise.resolve(
      jsonResponse({
        ok: true,
        genre: 'Roguelike',
        title: 'Roguelike',
        catalog_href: '/library?genre=Roguelike',
        sections: [
          {
            identifier: 'hub:genre:1:unplayed',
            title: 'Unplayed here',
            reason: 'In this genre and not on your play record',
            has_more: true,
            more_href: '/library?genre=Roguelike',
            games: [
              {
                uuid: 'hub-1',
                name: 'Hades',
                cover_url: '/static/library/images/hades.jpg',
                is_favorite: false,
              },
            ],
          },
        ],
      }),
    ),
  )

  renderHub()

  expect(await screen.findByRole('heading', { name: 'Unplayed here' })).toBeInTheDocument()
  expect(screen.getByText('In this genre and not on your play record')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Browse the catalog' })).toHaveAttribute(
    'href',
    '/library?genre=Roguelike',
  )
  expect(screen.queryByRole('button', { name: 'Pin' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Hide' })).not.toBeInTheDocument()
})

test('unknown genre shows the envelope sentence', async () => {
  global.fetch = vi.fn(() =>
    Promise.resolve(
      jsonResponse(
        { ok: false, error: 'That genre is not in this library.', error_code: 'not_found' },
        404,
      ),
    ),
  )

  renderHub('/discover/hub/genre/Missing')

  expect(await screen.findByText('Unable to load this genre hub.')).toBeInTheDocument()
  expect(screen.getByText('HTTP 404 · not_found')).toBeInTheDocument()
})
