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
    userId: rootElement.dataset.userId ? Number(rootElement.dataset.userId) : null,
    showTrailers: rootElement.dataset.showTrailers === 'true',
    showHelp: rootElement.dataset.showHelp === 'true',
    enableVr: rootElement.dataset.enableVr === 'true',
    // Absent attribute means an older shell render — default on rather than
    // hiding a surface that has always been there.
    enableActivity: rootElement.dataset.enableActivity !== 'false',
    // Two-bar chrome is on unless an operator explicitly sets false.
    enableNewChrome: rootElement.dataset.enableNewChrome !== 'false',
    showPlayStatus: rootElement.dataset.showPlayStatus === 'true',
    // Titles under catalog covers. Absent attribute means an older shell
    // render, and the strip is the default, so only an explicit false hides it.
    showTileTitles: rootElement.dataset.showTileTitles !== 'false',
    // AGPL §13 source offer — see config.ONEIRODEX_SOURCE_URL. A modified deployment
    // owes its users *its* source, so this is configuration, not a constant.
    sourceUrl: rootElement.dataset.sourceUrl || '',
    appVersion: rootElement.dataset.appVersion || '',
    username: rootElement.dataset.username || '',
    avatar: rootElement.dataset.avatar || '',
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
  // UIR-3: mark the document so shared CSS can retire page titles without every
  // page needing an edit. On <html> rather than the SPA root so Jinja admin can
  // set the same attribute server-side and get the identical treatment.
  if (memberAppRoot.dataset.enableNewChrome !== 'false') {
    document.documentElement.dataset.chrome = 'v2'
  }
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