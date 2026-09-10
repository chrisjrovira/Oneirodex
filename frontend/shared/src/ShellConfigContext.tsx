import { createContext, useContext, type ReactNode } from 'react'

/**
 * The non-identity half of the member-app bootstrap — `@oneirodex/ui`.
 *
 * Wave B1.6. Everything `parseShellConfig` reads off the SPA root element that
 * is *not* viewer identity (that half lives in `ViewerContext.tsx`): render
 * knobs (`perPage`, `tileSize`, `defaultSort`), catalog counts
 * (`libraryCount`, `gamesCount`, `unmatchedCount`), the "why is it empty"
 * signal (`scanHasRun`), feature toggles (`showPlayStatus`,
 * `enableDeleteOnDisk`, `enableNewChrome`, …) and `currentFilters`.
 *
 * It is passed through as-is: this context does no derivation, because the
 * shapes here are already the shapes pages want. Pages that used to take a
 * `shellConfig` prop now call `useShellConfig()`.
 */

/** The bootstrap bag — keys vary by page; consumers read the ones they need. */
export type ShellConfig = Record<string, unknown>

const MISSING = Symbol('ShellConfigContext.missing')

const ShellConfigContext = createContext<ShellConfig | typeof MISSING>(MISSING)

export interface ShellConfigProviderProps {
  value?: ShellConfig
  children?: ReactNode
}

export function ShellConfigProvider({ value, children }: ShellConfigProviderProps) {
  return <ShellConfigContext.Provider value={value ?? {}}>{children}</ShellConfigContext.Provider>
}

export function useShellConfig(): ShellConfig {
  const config = useContext(ShellConfigContext)
  if (config === MISSING) {
    throw new Error('useShellConfig must be used within a <ShellConfigProvider>')
  }
  return config
}
