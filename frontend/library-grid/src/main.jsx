import { createRoot } from 'react-dom/client'
import { DiscoverApp } from './DiscoverApp'
import { FavoritesApp } from './FavoritesApp'
import { GameDetailsApp, parseGameDetailsRootConfig } from './GameDetailsApp'
import { LibraryApp } from './LibraryApp'

export function parseRootConfig(rootElement) {
  let currentFilters = {}
  try {
    currentFilters = JSON.parse(rootElement.dataset.currentFilters || '{}')
  } catch {
    currentFilters = {}
  }

  return {
    perPage: Number(rootElement.dataset.perPage),
    defaultSort: rootElement.dataset.defaultSort,
    defaultSortOrder: rootElement.dataset.defaultSortOrder,
    isAdmin: rootElement.dataset.isAdmin === 'true',
    showPlayStatus: rootElement.dataset.showPlayStatus === 'true',
    libraryCount: Number(rootElement.dataset.libraryCount),
    gamesCount: Number(rootElement.dataset.gamesCount),
    enableDeleteOnDisk: rootElement.dataset.enableDeleteOnDisk === 'true',
    discordConfigured: rootElement.dataset.discordConfigured === 'true',
    discordManualTrigger: rootElement.dataset.discordManualTrigger === 'true',
    locale: rootElement.dataset.locale || 'en',
    currentFilters,
  }
}

export function parseFavoritesRootConfig(rootElement) {
  return {
    isAdmin: rootElement.dataset.isAdmin === 'true',
    showPlayStatus: rootElement.dataset.showPlayStatus === 'true',
  }
}

export function parseDiscoverRootConfig(rootElement) {
  let sections = []
  try {
    sections = JSON.parse(rootElement.dataset.sections || '[]')
  } catch {
    sections = []
  }

  return {
    sections,
    isAdmin: rootElement.dataset.isAdmin === 'true',
  }
}

const rootElement = document.getElementById('library-grid-root')
if (rootElement) {
  createRoot(rootElement).render(
    <LibraryApp initialConfig={parseRootConfig(rootElement)} />,
  )
}

const favoritesRootElement = document.getElementById('favorites-grid-root')
if (favoritesRootElement) {
  createRoot(favoritesRootElement).render(
    <FavoritesApp
      initialConfig={parseFavoritesRootConfig(favoritesRootElement)}
    />,
  )
}

const discoverRootElement = document.getElementById('discover-grid-root')
if (discoverRootElement) {
  createRoot(discoverRootElement).render(
    <DiscoverApp {...parseDiscoverRootConfig(discoverRootElement)} />,
  )
}

const detailsRootElement = document.getElementById('game-details-react-root')
if (detailsRootElement) {
  createRoot(detailsRootElement).render(
    <GameDetailsApp {...parseGameDetailsRootConfig(detailsRootElement)} />,
  )
}
