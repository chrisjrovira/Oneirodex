import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'

vi.mock('./LibraryApp', () => ({ LibraryApp: () => <div>LibraryPage</div> }))
vi.mock('./DiscoverApp', () => ({ DiscoverApp: () => <div>DiscoverPage</div> }))
vi.mock('./FavoritesApp', () => ({ FavoritesApp: () => <div>FavoritesPage</div> }))
vi.mock('./pages/DownloadsPage', () => ({ DownloadsPage: () => <div>DownloadsPage</div> }))
// Chrome is stubbed so route assertions are not coupled to the rail's contents.
vi.mock('./chrome/SideRail', () => ({ SideRail: () => <nav>SideRail</nav> }))
vi.mock('./chrome/TopBar', () => ({ TopBar: () => <header>TopBar</header> }))
vi.mock('./chrome/CommandPalette', () => ({
  CommandPalette: () => null,
  buildPaletteCommands: () => [],
}))
vi.mock('./components/SocialCompanionDock', () => ({
  SocialCompanionDock: () => null,
}))
vi.mock('./components/ChatSlideOut', () => ({
  ChatSlideOut: () => null,
}))
vi.mock('./pages/NewsPage', () => ({ NewsPage: () => <div><h1>News</h1></div> }))
vi.mock('./pages/CollectionsPage', () => ({
  CollectionsPage: ({ shellConfig }) => <div>CollectionsPage:{shellConfig.tileSize}</div>,
}))

test('layout exposes skip link and main landmark', () => {
  render(
    <MemoryRouter initialEntries={['/library']}>
      <App shellConfig={{ tileSize: 'M', isAdmin: false }} />
    </MemoryRouter>,
  )
  const skip = screen.getByRole('link', { name: /skip to main content/i })
  expect(skip).toHaveAttribute('href', '#main-content')
  expect(document.getElementById('main-content')).toBeTruthy()
  expect(document.getElementById('main-content').tagName).toBe('MAIN')
})

test('renders library route', () => {
  render(
    <MemoryRouter initialEntries={['/library']}>
      <App shellConfig={{ tileSize: 'M', isAdmin: false }} />
    </MemoryRouter>,
  )
  expect(screen.getByText('LibraryPage')).toBeInTheDocument()
  // TopNav already labels the Library route — no redundant page H1 here.
  expect(screen.queryByRole('heading', { name: 'Library' })).not.toBeInTheDocument()
})

test('applies tile size CSS vars from shellConfig', () => {
  render(
    <MemoryRouter initialEntries={['/discover']}>
      <App shellConfig={{ tileSize: 'L', isAdmin: false, sections: [] }} />
    </MemoryRouter>,
  )
  // Legacy L → 75% → 330px (120 + 280*0.75)
  expect(document.documentElement.style.getPropertyValue('--od-tile-min')).toBe('330px')
  expect(screen.getByText('DiscoverPage')).toBeInTheDocument()
})

test('renders favorites route with tile size', () => {
  render(
    <MemoryRouter initialEntries={['/favorites']}>
      <App shellConfig={{ tileSize: 'S', isAdmin: false }} />
    </MemoryRouter>,
  )
  expect(screen.getByText('FavoritesPage')).toBeInTheDocument()
  // Legacy S → 25% → 190px (120 + 280*0.25)
  expect(document.documentElement.style.getPropertyValue('--od-tile-min')).toBe('190px')
})

test('renders downloads route', async () => {
  render(
    <MemoryRouter initialEntries={['/downloads']}>
      <App shellConfig={{ tileSize: 'XL', isAdmin: false }} />
    </MemoryRouter>,
  )
  expect(await screen.findByText('DownloadsPage')).toBeInTheDocument()
  expect(document.documentElement.style.getPropertyValue('--od-tile-min')).toBe('400px')
})

test('renders news more route', async () => {
  render(
    <MemoryRouter initialEntries={['/news']}>
      <App shellConfig={{ tileSize: 'M', isAdmin: false }} />
    </MemoryRouter>,
  )
  expect(await screen.findByRole('heading', { name: 'News' })).toBeInTheDocument()
})

test('renders collections route with the real page and forwards shellConfig', async () => {
  render(
    <MemoryRouter initialEntries={['/collections']}>
      <App shellConfig={{ tileSize: 'M', isAdmin: false }} />
    </MemoryRouter>,
  )
  expect(await screen.findByText('CollectionsPage:M')).toBeInTheDocument()
})
