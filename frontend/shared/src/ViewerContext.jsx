import { createContext, useContext, useMemo } from 'react'

/**
 * Viewer identity + role predicates — `@oneirodex/ui`.
 *
 * Wave B1.6. member-app used to thread one `shellConfig` object from `main.jsx`
 * through `<App>`, `Layout` and into every one of 40+ routed pages as a prop,
 * and each call site re-derived `Boolean(shellConfig.isAdmin)` /
 * `shellConfig.role || 'user'` for itself. This context carries the *identity*
 * half of that bootstrap once, with the predicates derived here so no caller
 * has to spell the coercion again.
 *
 * The rest of the bootstrap (perPage, tileSize, counts, currentFilters, feature
 * toggles) is the ShellConfig context's job — see `ShellConfigContext.jsx`.
 * Identity is split out because far more components need "is this an admin"
 * than need "how many tiles per page", and a component that only asks the
 * former should not re-render when a filter changes.
 */

const MISSING = Symbol('ViewerContext.missing')

const ViewerContext = createContext(MISSING)

/**
 * Normalise a raw shell/bootstrap object into the viewer shape. Exported so
 * `main.jsx` can build the provider value from the parsed root config and so
 * tests can construct a viewer without knowing the derivation rules.
 *
 * `isChild` has no dedicated flag on the shell yet — it is the role name today
 * and stays derived here so callers converge on one spelling the moment the
 * backend grows the flag.
 */
export function viewerFromConfig(config = {}) {
  const role = config.role || 'user'
  return {
    userId: config.userId ?? null,
    role,
    isAdmin: Boolean(config.isAdmin) || role === 'admin',
    isLibrarian: Boolean(config.isLibrarian) || role === 'librarian',
    isChild: role === 'child',
    locale: config.locale || 'en',
  }
}

export function ViewerProvider({ value, children }) {
  // Accept either an already-normalised viewer or a raw shell slice; memoise so
  // a stable `value` prop does not remake the object every render.
  const viewer = useMemo(() => viewerFromConfig(value), [value])
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>
}

export function useViewer() {
  const viewer = useContext(ViewerContext)
  if (viewer === MISSING) {
    throw new Error('useViewer must be used within a <ViewerProvider>')
  }
  return viewer
}
