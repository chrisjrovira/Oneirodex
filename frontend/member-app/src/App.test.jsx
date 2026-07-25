import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'

vi.mock('./LibraryApp', () => ({ LibraryApp: () => <div>LibraryPage</div> }))
vi.mock('./DiscoverApp', () => ({ DiscoverApp: () => <div>DiscoverPage</div> }))
vi.mock('./FavoritesApp', () => ({ FavoritesApp: () => <div>FavoritesPage</div> }))
vi.mock('./pages/DownloadsPage', () => ({ DownloadsPage: () => <div>DownloadsPage</div> }))
vi.mock('./chrome/TopNav', () => ({ TopNav: () => <nav>TopNav</nav> }))

test('renders library route', () => {
  render(
    <MemoryRouter initialEntries={['/library']}>
      <App shellConfig={{ tileSize: 'M', isAdmin: false }} />
    </MemoryRouter>,
  )
  expect(screen.getByText('LibraryPage')).toBeInTheDocument()
})