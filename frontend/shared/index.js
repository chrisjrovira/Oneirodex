// Barrel for the shared frontend modules. Wave B1.1 only makes `frontend/shared`
// a valid npm workspace package (`@oneirodex/ui`) so the root install resolves
// it — the SPAs still import these files by relative path today. Wave B1.2
// builds out the real component API and moves consumers onto `@oneirodex/ui`.
export * from './confirmDialog.js'
export * from './libraryScanNotify.js'
export * from './toastStack.js'
export * from './useRailState.js'
