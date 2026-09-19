import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { getAccountSummary, type AccountSummary } from './accountApi.js'
import { ACCOUNT_PANELS, isPanelId, panelTitle } from './account/accountModalShared'
import type { AccountPanelId } from './account/accountModalShared'
import { ProfilePanel } from './account/AccountPanels'
import { AvatarPanel } from './account/AvatarPanel'
import { PasswordPanel } from './account/PasswordPanel'
import { InvitesPanel } from './account/InvitesPanel'
import { TokensPanel } from './account/TokensPanel'
export { ACCOUNT_PANELS } from './account/accountModalShared'
export type { AccountPanel, AccountPanelId } from './account/accountModalShared'
import './AccountModal.css'

/**
 * Same-origin browser client (ADR 0005), scoped to this modal's one
 * multipart call (`uploadAvatar`) — every other account/token verb here still
 * goes through `accountApi.js` / `tokensApi.js`'s own hand-rolled `fetch`.
 * `fetchImpl` is a thin wrapper, not a bare `fetch` reference, so a test that
 * `vi.stubGlobal('fetch', ...)` after this module has already loaded still
 * reaches the stub (see `admin-app/src/api/adminApi.ts`, which hit this first).
 */
export interface AccountModalProps {
  /** Which section to open on. A falsy value keeps the modal closed. */
  panel?: AccountPanelId | null
  onClose?: () => void
  onAvatarChange?: (path: string) => void
}

export function AccountModal({ panel, onClose, onAvatarChange }: AccountModalProps): ReactNode {
  const [active, setActive] = useState<AccountPanelId>(() => (isPanelId(panel) ? panel : 'profile'))
  const [summary, setSummary] = useState<AccountSummary | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (isPanelId(panel)) setActive(panel)
  }, [panel])

  // Both of these are gated on the modal actually being open.
  //
  // TopBar renders this component on every page with `panel={null}`, so an
  // ungated mount effect meant a `GET /api/account/summary` — and the invite
  // aggregate behind it — on every page load for a panel most visits never
  // open, plus a document-level key listener firing on every Escape in the app.
  useEffect(() => {
    if (!panel) return undefined
    const controller = new AbortController()
    getAccountSummary({ signal: controller.signal })
      .then(setSummary)
      .catch(() => {
        // The header degrades to the panel title alone. Failing to load the
        // summary must not stop the member changing their password.
      })
    return () => controller.abort()
  }, [panel])

  useEffect(() => {
    if (!panel) return undefined
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [panel, onClose])

  function handleAvatarUpdated(path: string) {
    setSummary((previous) => (previous ? { ...previous, avatar_path: path } : previous))
    onAvatarChange?.(path)
  }

  if (!panel) return null

  const body = (
    <div
      className="od-acct__scrim"
      role="presentation"
      onMouseDown={(event) => {
        // Only a press that both starts and ends on the scrim dismisses:
        // otherwise a drag-select that ends outside the panel closes the modal
        // and throws away whatever was typed.
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div
        className="od-acct"
        data-panel={active}
        role="dialog"
        aria-modal="true"
        aria-label={panelTitle(active)}
        ref={panelRef}
      >
        <button type="button" className="od-acct__close" aria-label="Close" onClick={onClose}>
          ×
        </button>

        <header className="od-acct__head">
          <p className="od-acct__eyebrow">Account</p>
          <h2 className="od-acct__title">{panelTitle(active)}</h2>
          {summary ? (
            <p className="od-acct__lede">
              {summary.username}
              {summary.role ? ` · ${summary.role}` : ''}
            </p>
          ) : null}
        </header>

        {/* Separate `.od-cbtn` buttons, not one joined `.od-seg` pill.
            A segmented control says "these are mutually exclusive views of one
            thing" and draws a single outline around the set, which read as a box
            wrapped around a box inside the panel. These are five destinations,
            the same kind of thing the top bar's buttons are, so they wear the
            same clothes — and they pack left, because a modal reads top-left to
            bottom-right and there is nothing to centre them against. */}
        <div className="od-acct__tabs" role="group" aria-label="Account sections">
          {ACCOUNT_PANELS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`od-cbtn${entry.id === active ? ' is-on' : ''}`}
              aria-pressed={entry.id === active}
              onClick={() => setActive(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="od-acct__body">
          {active === 'profile' ? <ProfilePanel summary={summary} /> : null}
          {active === 'avatar' ? (
            <AvatarPanel summary={summary} onUpdated={handleAvatarUpdated} />
          ) : null}
          {active === 'password' ? <PasswordPanel /> : null}
          {active === 'invites' ? <InvitesPanel /> : null}
          {active === 'tokens' ? <TokensPanel /> : null}
        </div>
      </div>
    </div>
  )

  // Portalled to <body> for the same reason the preview is: the shell's main
  // column is a scroll container, and a fixed scrim inside one is clipped to it.
  return typeof document === 'undefined' ? body : createPortal(body, document.body)
}

export default AccountModal
