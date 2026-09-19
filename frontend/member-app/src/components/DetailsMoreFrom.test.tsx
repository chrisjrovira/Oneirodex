import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DetailsMoreFrom } from './DetailsMoreFrom'
import { stubFetch } from '../testJsonResponse'

vi.mock('./DiscoverShelf', () => ({
  DiscoverShelf: ({ section }) => <div>{section.title}</div>,
}))

test('renders vault shelves and hides when the API is empty', async () => {
  stubFetch(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          sections: [
            {
              identifier: 'more_developer:abc',
              title: 'More from Maddy Makes Games',
              games: [{ uuid: '1', name: 'Other' }],
              total_count: 1,
              has_more: false,
            },
          ],
        }),
    }),
  )

  render(
    <MemoryRouter>
      <DetailsMoreFrom gameUuid="abc" />
    </MemoryRouter>,
  )

  expect(await screen.findByText('More from Maddy Makes Games')).toBeInTheDocument()
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/games/abc/more_from',
      expect.objectContaining({ credentials: 'include' }),
    )
  })
})

test('renders nothing when there are no siblings', async () => {
  stubFetch(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ ok: true, sections: [] }),
    }),
  )

  const { container } = render(
    <MemoryRouter>
      <DetailsMoreFrom gameUuid="abc" />
    </MemoryRouter>,
  )

  await waitFor(() => expect(global.fetch).toHaveBeenCalled())
  expect(container).toBeEmptyDOMElement()
})
