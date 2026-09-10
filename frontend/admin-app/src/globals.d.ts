// Ambient globals the admin SPA reads off `window` — bridges to the classic
// Jinja theme JS (libraries batch-edit / delete prompts) and a Chromium-only
// navigator field. PR-4 (e): declared here so strict-ish `tsc` stops flagging
// the property access; the runtime guards (`typeof window.x === 'function'`)
// stay the real safety net.

interface Window {
  odLibrariesAskDelete?: (...args: unknown[]) => void
  odLibrariesOpenBatchEdit?: (...args: unknown[]) => void
  odHoistBootstrapModals?: (element: Element) => void
}

interface Navigator {
  userAgentData?: { mobile?: boolean; platform?: string }
}
