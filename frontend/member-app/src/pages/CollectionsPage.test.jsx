import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CollectionDetailPage } from './CollectionDetailPage'
import { CollectionsPage } from './CollectionsPage'
import * as collectionsApi from '../api/collections'

vi.mock('../api/collections', () => ({
  fetchCollections: vi.fn(),
  fetchCollection: vi.fn(),
  createCollection: vi.fn(),
  addCollectionItem: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <CollectionsPage />
    </MemoryRouter>,
  )
}

function renderDetailPage(uuid = 'abc-123') {
  return render(
    <MemoryRouter initialEntries={[`/collections/${uuid}`]}>
      <Routes>
        <Route path="/collections/:collectionUuid" element={<CollectionDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  collectionsApi.fetchCollections.mockReset()
  collectionsApi.fetchCollection.mockReset()
  collectionsApi.createCollection.mockReset()
  collectionsApi.addCollectionItem.mockReset()
})

test('lists collections from API and links to detail routes', async () => {
  collectionsApi.fetchCollections.mockResolvedValue({
    collections: [
      {
        id: 1,
        uuid: 'abc-123',
        name: 'Cozy co-op nights',
        description: 'Couch games',
        is_public: true,
        is_system: false,
      },
    ],
  })

  renderPage()

  expect(screen.getByText('Loading…')).toBeInTheDocument()

  const link = await screen.findByRole('link', { name: /Cozy co-op nights/ })
  expect(link).toHaveAttribute('href', '/collections/abc-123')
  expect(within(link).getByText('Couch games')).toBeInTheDocument()
  expect(within(link).getByText('Public')).toBeInTheDocument()
})

test('shows empty state when no collections', async () => {
  collectionsApi.fetchCollections.mockResolvedValue({ collections: [] })

  renderPage()

  expect(
    await screen.findByText('No collections yet. Create your first shelf with the form above.'),
  ).toBeInTheDocument()
})

test('shows retry control when the request fails', async () => {
  collectionsApi.fetchCollections.mockRejectedValueOnce(new Error('collections 500'))
  collectionsApi.fetchCollections.mockResolvedValueOnce({ collections: [] })

  renderPage()

  expect(await screen.findByText('Unable to load collections.')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))

  expect(
    await screen.findByText('No collections yet. Create your first shelf with the form above.'),
  ).toBeInTheDocument()
})

test('creates a collection and shows it in the list', async () => {
  collectionsApi.fetchCollections.mockResolvedValue({ collections: [] })
  collectionsApi.createCollection.mockResolvedValue({
    id: 7,
    uuid: 'new-uuid',
    name: 'Roguelites',
    description: '',
    is_public: true,
    is_system: false,
  })

  renderPage()

  await screen.findByText('No collections yet. Create your first shelf with the form above.')

  await userEvent.type(screen.getByLabelText('Name'), 'Roguelites')
  await userEvent.click(screen.getByRole('button', { name: 'Create' }))

  expect(collectionsApi.createCollection).toHaveBeenCalledWith({
    name: 'Roguelites',
    description: '',
    isPublic: true,
  })
  expect(await screen.findByRole('link', { name: /Roguelites/ })).toHaveAttribute(
    'href',
    '/collections/new-uuid',
  )
})

test('detail page renders items for the routed collection uuid', async () => {
  collectionsApi.fetchCollection.mockResolvedValue({
    id: 1,
    uuid: 'abc-123',
    name: 'Cozy co-op nights',
    description: 'Couch games',
    items: [{ id: 5, game_uuid: 'game-1', game_name: 'Overcooked', position: 0 }],
  })

  renderDetailPage()

  expect(screen.getByText('Loading…')).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: 'Cozy co-op nights' })).toBeInTheDocument()
  expect(collectionsApi.fetchCollection).toHaveBeenCalledWith(
    'abc-123',
    expect.objectContaining({ signal: expect.anything() }),
  )
  expect(screen.getByRole('link', { name: /Overcooked/ })).toHaveAttribute(
    'href',
    '/game_details/game-1',
  )
})

test('detail page shows an empty state when the collection has no games', async () => {
  collectionsApi.fetchCollection.mockResolvedValue({
    id: 2,
    uuid: 'empty-uuid',
    name: 'Empty shelf',
    description: null,
    items: [],
  })

  renderDetailPage('empty-uuid')

  expect(
    await screen.findByText('No games in this collection yet. Add one with its game ID below.'),
  ).toBeInTheDocument()
})
