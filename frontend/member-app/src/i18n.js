const STRINGS = {
  en: {
    'No libraries found. Add a library to get started.':
      'No libraries found. Add a library to get started.',
    'No libraries are available.': 'No libraries are available.',
    'No games found in your libraries.': 'No games found in your libraries.',
    'No games match the current filters.': 'No games match the current filters.',
    'Unable to load games.': 'Unable to load games.',
    'Unable to refresh games.': 'Unable to refresh games.',
    'Unable to load filter options.': 'Unable to load filter options.',
    Library: 'Library',
    'Library platform': 'System / console',
    'System / console': 'System / console',
    'IGDB platform': 'Catalog platform',
    'Catalog platform': 'Catalog platform',
    Genre: 'Genre',
    Theme: 'Theme',
    'Game mode': 'Game mode',
    'Player perspective': 'Player perspective',
    'All Libraries': 'All Libraries',
    'All Library Platforms': 'All systems',
    'All systems': 'All systems',
    'All IGDB Platforms': 'All catalog platforms',
    'All catalog platforms': 'All catalog platforms',
    Installed: 'Installed',
    Companion: 'Companion',
    'All games': 'All games',
    'Installed only': 'Installed only',
    'Companion installed': 'Companion installed',
    'All Genres': 'All Genres',
    'All Themes': 'All Themes',
    'All Game Modes': 'All Game Modes',
    'All Perspectives': 'All Perspectives',
    Rating: 'Rating',
    'Sort by': 'Sort by',
    'Sort order': 'Sort order',
    Name: 'Name',
    'Date Released': 'Date Released',
    'Date Added': 'Date Added',
    Filesize: 'Filesize',
    Ascending: 'Ascending',
    Descending: 'Descending',
    Apply: 'Apply',
    Clear: 'Clear',
    Retry: 'Retry',
    'Per page': 'Per page',
    First: 'First',
    Previous: 'Previous',
    Next: 'Next',
    Last: 'Last',
    'Page {page} of {pages}': 'Page {page} of {pages}',
  },
  es: {
    'No libraries found. Add a library to get started.':
      'No se encontraron bibliotecas. Agrega una para comenzar.',
    'No libraries are available.': 'No hay bibliotecas disponibles.',
    'No games found in your libraries.': 'No se encontraron juegos en tus bibliotecas.',
    'No games match the current filters.': 'Ningún juego coincide con los filtros.',
    'Unable to load games.': 'No se pudieron cargar los juegos.',
    'Unable to refresh games.': 'No se pudieron actualizar los juegos.',
    'Unable to load filter options.': 'No se pudieron cargar los filtros.',
    Library: 'Biblioteca',
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
    Clear: 'Limpiar',
    Retry: 'Reintentar',
    'Per page': 'Por página',
    First: 'Primera',
    Previous: 'Anterior',
    Next: 'Siguiente',
    Last: 'Última',
    'Page {page} of {pages}': 'Página {page} de {pages}',
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
