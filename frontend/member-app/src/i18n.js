const STRINGS = {
  en: {
    'No libraries found. Add a library to get started.':
      'No libraries yet. Add one and Oneirodex starts filling the shelves.',
    'No libraries are available.': "Nothing here yet — an admin hasn't added a library.",
    'No games found in your libraries.':
      "Shelves are up but empty. Nothing's turned up in a scan yet.",
    'No games match the current filters.':
      'Nothing made it through those filters. Loosen one and try again.',
    'Unable to load games.': "Couldn't load your catalog. Give it another go.",
    'Unable to refresh games.': "Couldn't refresh. You're still seeing the last good load.",
    'Unable to load filter options.':
      "Couldn't load the filters. You can still browse everything below.",
    Library: 'Library',
    'Game Catalog': 'Game Catalog',
    'Library filters': 'Game Catalog filters',
    'Library selection actions': 'Game Catalog selection actions',
    'Library platform': 'System / console',
    'System / console': 'System / console',
    'IGDB platform': 'Catalog platform',
    'Catalog platform': 'Catalog platform',
    Genre: 'Genre',
    Theme: 'Theme',
    'Game mode': 'Game mode',
    'Player perspective': 'Player perspective',
    'All Libraries': 'All libraries',
    'All Library Platforms': 'All systems',
    'All systems': 'All systems',
    'All IGDB Platforms': 'All catalog platforms',
    'All catalog platforms': 'All catalog platforms',
    Installed: 'Installed',
    Companion: 'Companion',
    'All games': 'All games',
    'Installed only': 'Installed only',
    'Companion installed': 'Companion installed',
    'All Genres': 'All genres',
    'All Themes': 'All themes',
    'All Game Modes': 'All game modes',
    'All Perspectives': 'All perspectives',
    Rating: 'Rating',
    'Sort by': 'Sort by',
    'Sort order': 'Sort order',
    Name: 'Name',
    'Date Released': 'Date released',
    'Date Added': 'Date added',
    Filesize: 'File size',
    Ascending: 'Ascending',
    Descending: 'Descending',
    Apply: 'Apply',
    Clear: 'Clear filters',
    Retry: 'Retry',
    'Per page': 'Per page',
    First: 'First',
    Previous: 'Previous',
    Next: 'Next',
    Last: 'Last',
    'Page {page} of {pages}': 'Page {page} of {pages}',
    Layout: 'Layout',
    Tile: 'Tile',
    Rows: 'Rows',
    Grid: 'Grid',
  },
  es: {
    'No libraries found. Add a library to get started.':
      'Aún no hay bibliotecas. Agrega una y Oneirodex empezará a llenar los estantes.',
    'No libraries are available.':
      'Todavía no hay nada aquí: un administrador aún no ha agregado una biblioteca.',
    'No games found in your libraries.':
      'Los estantes están listos, pero vacíos. Ningún escaneo ha encontrado nada todavía.',
    'No games match the current filters.':
      'Ningún juego pasó esos filtros. Quita alguno y vuelve a intentarlo.',
    'Unable to load games.': 'No se pudo cargar tu catálogo. Inténtalo de nuevo.',
    'Unable to refresh games.':
      'No se pudo actualizar. Sigues viendo los últimos datos correctos.',
    'Unable to load filter options.':
      'No se pudieron cargar los filtros. Aun así puedes explorar todo lo de abajo.',
    Library: 'Biblioteca',
    'Game Catalog': 'Catálogo de juegos',
    'Library filters': 'Filtros del catálogo',
    'Library selection actions': 'Acciones de selección del catálogo',
    'Library platform': 'Sistema / consola',
    'System / console': 'Sistema / consola',
    'IGDB platform': 'Plataforma del catálogo',
    'Catalog platform': 'Plataforma del catálogo',
    Genre: 'Género',
    Theme: 'Tema',
    'Game mode': 'Modo de juego',
    'Player perspective': 'Perspectiva',
    'All Libraries': 'Todas las bibliotecas',
    'All Library Platforms': 'Todos los sistemas',
    'All systems': 'Todos los sistemas',
    'All IGDB Platforms': 'Todas las plataformas del catálogo',
    'All catalog platforms': 'Todas las plataformas del catálogo',
    Installed: 'Instalados',
    Companion: 'Companion',
    'All games': 'Todos los juegos',
    'Installed only': 'Solo instalados',
    'Companion installed': 'Instalados en companion',
    'All Genres': 'Todos los géneros',
    'All Themes': 'Todos los temas',
    'All Game Modes': 'Todos los modos',
    'All Perspectives': 'Todas las perspectivas',
    Rating: 'Valoración',
    'Sort by': 'Ordenar por',
    'Sort order': 'Orden',
    Name: 'Nombre',
    'Date Released': 'Fecha de lanzamiento',
    'Date Added': 'Fecha de alta',
    Filesize: 'Tamaño',
    Ascending: 'Ascendente',
    Descending: 'Descendente',
    Apply: 'Aplicar',
    Clear: 'Limpiar filtros',
    Retry: 'Reintentar',
    'Per page': 'Por página',
    First: 'Primera',
    Previous: 'Anterior',
    Next: 'Siguiente',
    Last: 'Última',
    'Page {page} of {pages}': 'Página {page} de {pages}',
    Layout: 'Diseño',
    Tile: 'Portadas',
    Rows: 'Filas',
    Grid: 'Cuadrícula',
  },
}

export function normalizeLocale(locale) {
  const raw = (locale || 'en').toLowerCase()
  if (raw.startsWith('es')) return 'es'
  return 'en'
}

export function createTranslator(locale) {
  const lang = normalizeLocale(locale)
  const table = STRINGS[lang] || STRINGS.en
  return function t(key, vars = {}) {
    let text = table[key] || STRINGS.en[key] || key
    Object.entries(vars).forEach(([name, value]) => {
      text = text.replace(`{${name}}`, String(value))
    })
    return text
  }
}
