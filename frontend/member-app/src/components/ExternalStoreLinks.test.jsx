import { render, screen } from '@testing-library/react'
import { ExternalStoreLinks } from './ExternalStoreLinks'

test('renders recognizable brand labels for common store / catalog urls', () => {
  render(
    <ExternalStoreLinks
      steamUrl="https://store.steampowered.com/app/504230"
      igdbUrl="https://www.igdb.com/games/celeste"
      urls={[
        { type: 'gog', url: 'https://www.gog.com/game/celeste' },
        { type: 'epicgames', url: 'https://store.epicgames.com/en-US/p/celeste' },
        { type: 'youtube', url: 'https://www.youtube.com/watch?v=70N5mY4iNAw' },
        { type: 'wikipedia', url: 'https://en.wikipedia.org/wiki/Celeste_(video_game)' },
        { type: 'official', url: 'http://www.celestegame.com/' },
      ]}
    />,
  )

  expect(screen.getByRole('list', { name: /store and catalog links/i })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Steam' })).toHaveAttribute(
    'href',
    'https://store.steampowered.com/app/504230',
  )
  expect(screen.getByRole('link', { name: 'IGDB' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'GOG' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Epic' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'YouTube' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Wikipedia' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Official site' })).toBeInTheDocument()
})

test('matches new store brand ids from type and url', () => {
  render(
    <ExternalStoreLinks
      urls={[
        { type: 'psn', url: 'https://store.playstation.com/en-us/product/UP0001' },
        { type: 'xbox', url: 'https://www.xbox.com/games/store/halo' },
        { type: 'primegaming', url: 'https://gaming.amazon.com/home' },
        { type: 'humble', url: 'https://www.humblebundle.com/store/celeste' },
        { type: 'itch', url: 'https://example.itch.io/game' },
        { type: 'origin', url: 'https://www.ea.com/games/apex-legends' },
        { type: 'uplay', url: 'https://store.ubi.com/game' },
        { type: 'wikia', url: 'https://celeste.fandom.com/wiki/Celeste' },
      ]}
    />,
  )

  expect(screen.getByRole('link', { name: 'PlayStation' })).toHaveClass('gt-store-link--playstation')
  expect(screen.getByRole('link', { name: 'Xbox' })).toHaveClass('gt-store-link--xbox')
  expect(screen.getByRole('link', { name: 'Amazon' })).toHaveClass('gt-store-link--amazon')
  expect(screen.getByRole('link', { name: 'Humble' })).toHaveClass('gt-store-link--humble')
  expect(screen.getByRole('link', { name: 'itch.io' })).toHaveClass('gt-store-link--itch')
  expect(screen.getByRole('link', { name: 'EA' })).toHaveClass('gt-store-link--ea')
  expect(screen.getByRole('link', { name: 'Ubisoft' })).toHaveClass('gt-store-link--ubisoft')
  expect(screen.getByRole('link', { name: 'Fandom' })).toHaveClass('gt-store-link--fandom')
})

test('dedupes urls and uses unknown mark for empty / unrecognized types', () => {
  render(
    <ExternalStoreLinks
      urls={[
        { type: 'steam', url: 'https://store.steampowered.com/app/1' },
        { type: 'steam', url: 'https://store.steampowered.com/app/1' },
        { type: '', url: 'https://example.com/mystery-storefront' },
        { type: 'obscure-shop', url: 'https://example.org/other' },
      ]}
    />,
  )

  expect(screen.getAllByRole('link', { name: 'Steam' })).toHaveLength(1)
  expect(screen.getByRole('link', { name: 'Link' })).toHaveClass('gt-store-link--unknown')
  expect(screen.getByRole('link', { name: 'obscure-shop' })).toHaveClass('gt-store-link--unknown')
})

test('returns null when no safe http links', () => {
  const { container } = render(
    <ExternalStoreLinks urls={[{ type: 'steam', url: 'javascript:alert(1)' }]} />,
  )
  expect(container.firstChild).toBeNull()
})
