// Barrel for `@oneirodex/ui` — the one home for infrastructure the three SPAs
// (member-app, admin-app, ops-glance) all need.
//
// Wave B1.1 made `frontend/shared` a valid npm workspace package. Wave B1.2
// moves the real implementations here — one canonical copy of each module that
// had drifted into 2-3 divergent copies across the SPAs — and repoints every
// consumer onto `import { X } from '@oneirodex/ui'`.
//
// Behavioural rule when copies diverged: the superset wins, so consolidating
// widens the narrow copies and narrows none.

export * from './confirmDialog.js'
export * from './libraryScanNotify.js'
export * from './toastStack.js'
export * from './useRailState.js'
export * from './csrf.js'
export * from './envelopeError.js'
export * from './loadingStatusText.js'
export * from './toast.js'
export * from './pageStatus.jsx'
export * from './useResource.jsx'
export * from './ViewerContext.jsx'
export * from './ShellConfigContext.jsx'
