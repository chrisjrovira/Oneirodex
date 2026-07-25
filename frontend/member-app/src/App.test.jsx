import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'

vi.mock('./LibraryApp', () => ({ LibraryApp: () => <div>LibraryPage</div> }))
vi.mock('./DiscoverApp', () => ({ DiscoverApp: () => <div>DiscoverPage</div> }))
vi.mock('./FavoritesApp', () => ({ FavoritesApp: () => <div>FavoritesPage</div> }))
vi.mock('./pages/DownloadsPage', () => ({ DownloadsPage: () => <div>DownloadsPage</div> }))
vi.mock('./chrome/TopNav', () => ({ TopNav: () => <nav>TopNav</nav> }))
vi.mock('./pages/NewsPage', () => ({ NewsPage: () => <div><h1>News</h1></div> }))

test('renders library route', () => {
  render(
    <MemoryRouter initialEntries={['/library']}>
      <App shellConfig={{ tileSize: 'M', isAdmin: false }} />
    </MemoryRouter>,
  )
  expect(screen.getByText('LibraryPage')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument()
})

test('applies tile size CSS vars from shellConfig', () => {
  render(
    <MemoryRouter initialEntries={['/discover']}>
      <App shellConfig={{ tileSize: 'L', isAdmin: false, sections: [] }} />
    </MemoryRouter>,
  )
  expect(document.documentElement.style.getPropertyValue('--gt-tile-min')).toBe('220px')
  expect(screen.getByText('DiscoverPage')).toBeInTheDocument()
})

test('renders favorites route with tile size', () => {
  render(
    <MemoryRouter initialEntries={['/favorites']}>
      <App shellConfig={{ tileSize: 'S', isAdmin: false }} />
    </MemoryRouter>,
  )
  expect(screen.getByText('FavoritesPage')).toBeInTheDocument()
  expect(document.documentElement.style.getPropertyValue('--gt-tile-min')).toBe('140px')
})

test('renders downloads route', () => {
  render(
    <MemoryRouter initialEntries={['/downloads']}>
      <App shellConfig={{ tileSize: 'XL', isAdmin: false }} />
    </MemoryRouter>,
  )
  expect(screen.getByText('DownloadsPage')).toBeInTheDocument()
  expect(document.documentElement.style.getPropertyValue('--gt-tile-min')).toBe('280px')
})

test('renders news more route', () => {
  render(
    <MemoryRouter initialEntries={['/news']}>
      <App shellConfig={{ tileSize: 'M', isAdmin: false }} />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { name: 'News' })).toBeInTheDocument()
})

test('renders collections stub route', () => {
  render(
    <MemoryRouter initialEntries={['/collections']}>
      <App shellConfig={{ tileSize: 'M', isAdmin: false }} />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { name: 'Collections' })).toBeInTheDocument()
  expect(screen.getByText('Loading…')).toBeInTheDocument()
})
