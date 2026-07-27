import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { GameDetailsApp, parseGameDetailsRootConfig } from './GameDetailsApp'

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
  return {
    isAdmin: rootElement.dataset.isAdmin === 'true',
  }
}

export function parseShellConfig(rootElement) {
  let currentFilters = {}
  try {
    currentFilters = JSON.parse(rootElement.dataset.currentFilters || '{}')
  } catch {
    currentFilters = {}
  }

  return {
    tileSize: rootElement.dataset.tileSize || 'M',
    isAdmin: rootElement.dataset.isAdmin === 'true',
    isLibrarian: rootElement.dataset.isLibrarian === 'true',
    role: rootElement.dataset.role || 'user',
    showTrailers: rootElement.dataset.showTrailers === 'true',
    showHelp: rootElement.dataset.showHelp === 'true',
    enableVr: rootElement.dataset.enableVr === 'true',
    showPlayStatus: rootElement.dataset.showPlayStatus === 'true',
    username: rootElement.dataset.username || '',
    locale: rootElement.dataset.locale || 'en',
    perPage: Number(rootElement.dataset.perPage) || 20,
    defaultSort: rootElement.dataset.defaultSort || 'name',
    defaultSortOrder: rootElement.dataset.defaultSortOrder || 'asc',
    libraryCount: Number(rootElement.dataset.libraryCount) || 0,
    gamesCount: Number(rootElement.dataset.gamesCount) || 0,
    enableDeleteOnDisk: rootElement.dataset.enableDeleteOnDisk === 'true',
    currentFilters,
  }
}

const memberAppRoot = document.getElementById('member-app-root')
if (memberAppRoot) {
  createRoot(memberAppRoot).render(
    <BrowserRouter>
      <App shellConfig={parseShellConfig(memberAppRoot)} />
    </BrowserRouter>,
  )
}

const detailsRootElement = document.getElementById('game-details-react-root')
if (detailsRootElement) {
  createRoot(detailsRootElement).render(
    <GameDetailsApp {...parseGameDetailsRootConfig(detailsRootElement)} />,
  )
}