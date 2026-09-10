import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import {
  changePassword,
  chooseStockAvatar,
  createInvite,
  getAccountSummary,
  listInvites,
  revokeInvite,
  uploadAvatar,
  type AccountSummary,
  type ListInvitesResponse,
} from './accountApi.js'
import {
  createToken,
  extractOneTimeSecret,
  listTokens,
  revokeToken,
  type ApiToken,
} from './tokensApi.js'
import { copyText } from './copyText.js'
import { PageStatus } from './pageStatus.js'
import './AccountModal.css'

/**
 * Account modals: profile, avatar, password, invites, API tokens.
 *
 * Each of these was a page you navigated to. That is a whole-page trip, a lost
 * scroll position and a browser back button, for a two-field form — and because
 * they were server-rendered in an older idiom, arriving at one also looked like
 * leaving the app. They open here instead, in the same panel object the game
 * preview uses, and they switch between each other without closing.
 *
 * The server-rendered pages are still there and still work; they are the no-JS
 * and Big Picture path. This replaces the *route* the member takes to them, not
 * the routes themselves.
 */

/** The five sections the modal switches between. */
export type AccountPanelId = 'profile' | 'avatar' | 'password' | 'invites' | 'tokens'

/** One entry in the account section tab strip. */
export interface AccountPanel {
  id: AccountPanelId
  label: string
  title: string
}

export const ACCOUNT_PANELS: AccountPanel[] = [
  { id: 'profile', label: 'Profile', title: 'Profile' },
  { id: 'avatar', label: 'Avatar', title: 'Change avatar' },
  { id: 'password', label: 'Password', title: 'Change password' },
  { id: 'invites', label: 'Invites', title: 'Invites' },
  { id: 'tokens', label: 'API tokens', title: 'API tokens' },
]

const PANEL_IDS: Set<string> = new Set(ACCOUNT_PANELS.map((panel) => panel.id))

/** True when `value` names one of {@link ACCOUNT_PANELS}. */
function isPanelId(value: unknown): value is AccountPanelId {
  return typeof value === 'string' && PANEL_IDS.has(value)
}

function panelTitle(id: string): string {
  return ACCOUNT_PANELS.find((panel) => panel.id === id)?.title || 'Account'
}

/**
 * Where to load an avatar from.
 *
 * Prefers the server's resolved `avatar_url`, which routes the shipped avatars
 * through the active theme — they are flat SVGs rendered as `<img>`, so they
 * cannot pick up a theme colour on their own and stayed default-green on every
 * preset until the server started recolouring them.
 *
 * `avatar_path` remains the fallback and the identity: it is what the client
 * sends back when picking a stock avatar, and it is what an older server (or
 * one whose theme folders predate the recoloured copies) will be sending.
 */
function avatarSrc(
  summary: AccountSummary | null | undefined,
  path: string | null | undefined,
): string {
  const resolved = summary?.avatar_url
  if (resolved && (!path || path === summary?.avatar_path)) return resolved
  if (!path) return ''
  return path.startsWith('/') ? path : `/static/${path}`
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return String(iso)
  }
}

/** Read `error` off a thrown envelope error without leaking `[object Object]`. */
function messageOf(error: unknown, fallback: string): string {
  const raw =
    error && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message.trim()
      : ''
  return raw || fallback
}

interface NoteProps {
  tone: 'error' | 'good'
  children?: ReactNode
}

function Note({ tone, children }: NoteProps): ReactNode {
  if (!children) return null
  return (
    <p
      className={`od-acct__note od-acct__note--${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </p>
  )
}

/* ---------------------------------------------------------------- profile */

/**
 * Who you are, and nothing else.
 *
 * It used to carry a row apiece for Invites, Avatar and Password, each with a
 * button that switched to the tab sitting directly above it. Three rows to say
 * what three tabs already said, and the "3 of 5 invites left" line repeated
 * what the Invites panel opens with.
 */
function ProfilePanel({ summary }: { summary: AccountSummary | null }): ReactNode {
  if (!summary) return <PageStatus loading inline className="od-acct__empty" />

  return (
    <div className="od-acct__avatar-row">
      <img className="od-acct__avatar" src={avatarSrc(summary, summary.avatar_path)} alt="" />
      <div className="od-acct__avatar-meta">
        <p className="od-acct__row-title">{summary.username}</p>
        <p className="od-acct__row-sub">{summary.role}</p>
        {/* An emailless household account shows what it is rather than a
            placeholder address nobody can write to. */}
        <p className="od-acct__row-sub">{summary.email || 'No email on this account'}</p>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- avatar */

interface AvatarPanelProps {
  summary: AccountSummary | null
  onUpdated?: (path: string) => void
}

function AvatarPanel({ summary, onUpdated }: AvatarPanelProps): ReactNode {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  // Object URLs are a real allocation; revoke the previous one whenever the
  // selection changes and the last one on unmount, or a member trying four
  // pictures leaks four blobs for the life of the tab.
  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || busy) return
    setBusy(true)
    setError('')
    setDone('')
    try {
      const data = await uploadAvatar(file)
      setDone('Avatar updated.')
      setFile(null)
      onUpdated?.(data.avatar_path)
    } catch (err) {
      setError(messageOf(err, 'Could not upload that image.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleStock(id: string) {
    if (busy) return
    setBusy(true)
    setError('')
    setDone('')
    try {
      const data = await chooseStockAvatar(id)
      setDone('Avatar updated.')
      setFile(null)
      onUpdated?.(data.avatar_path)
    } catch (err) {
      setError(messageOf(err, 'Could not set that avatar.'))
    } finally {
      setBusy(false)
    }
  }

  const stock = summary?.stock_avatars || []
  const shown = previewUrl || avatarSrc(summary, summary?.avatar_path)

  return (
    <form onSubmit={handleSubmit}>
      <Note tone="error">{error}</Note>
      <Note tone="good">{done}</Note>

      <div className="od-acct__avatar-row">
        <img className="od-acct__avatar" src={shown} alt="" />
        <div className="od-acct__avatar-meta">
          <input
            id="od-acct-avatar-file"
            className="od-acct__file"
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null)
              setDone('')
              setError('')
            }}
          />
          <label className="od-cbtn od-acct__file-label" htmlFor="od-acct-avatar-file">
            Choose image
          </label>
          <p className="od-acct__hint">
            PNG, JPEG, GIF or WebP, up to 5MB. Square crops best — anything else is centred and
            cropped for you.
          </p>
          {file ? <p className="od-acct__hint">{file.name}</p> : null}
        </div>
      </div>

      <div className="od-acct__actions">
        <button type="submit" className="od-cbtn od-cbtn--primary" disabled={!file || busy}>
          {busy ? 'Uploading…' : 'Save avatar'}
        </button>
        {file ? (
          <button type="button" className="od-cbtn" onClick={() => setFile(null)} disabled={busy}>
            Cancel
          </button>
        ) : null}
      </div>

      {/* Stock picks, so having no picture to hand is not a dead end.
          Applied on click rather than staged behind Save: there is nothing to
          review — the tile you clicked is exactly what you get. */}
      {stock.length > 0 ? (
        <>
          <p className="od-acct__label od-acct__label--follow">Or pick one</p>
          <ul className="od-acct__stock">
            {stock.map((entry) => {
              const selected = summary?.avatar_path === entry.path
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    className="od-acct__stock-btn"
                    aria-pressed={selected}
                    aria-label={entry.label}
                    title={entry.label}
                    disabled={busy}
                    onClick={() => handleStock(entry.id)}
                  >
                    <img src={entry.url} alt="" />
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      ) : null}
    </form>
  )
}

/* --------------------------------------------------------------- password */

interface PasswordValues {
  current: string
  next: string
  confirm: string
}

function PasswordPanel(): ReactNode {
  const [values, setValues] = useState<PasswordValues>({ current: '', next: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  function update(key: keyof PasswordValues) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target
      setValues((previous) => ({ ...previous, [key]: value }))
      setError('')
      setDone('')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setDone('')
    try {
      await changePassword({
        current_password: values.current,
        new_password: values.next,
        confirm_password: values.confirm,
      })
      setDone('Password changed.')
      setValues({ current: '', next: '', confirm: '' })
    } catch (err) {
      setError(messageOf(err, 'Could not change your password.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Note tone="error">{error}</Note>
      <Note tone="good">{done}</Note>

      <label className="od-acct__field">
        <span className="od-acct__label">Current password</span>
        <input
          className="od-acct__input"
          type="password"
          autoComplete="current-password"
          value={values.current}
          onChange={update('current')}
          required
        />
      </label>

      <label className="od-acct__field">
        <span className="od-acct__label">New password</span>
        <input
          className="od-acct__input"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={values.next}
          onChange={update('next')}
          required
        />
      </label>

      <label className="od-acct__field">
        <span className="od-acct__label">Confirm new password</span>
        <input
          className="od-acct__input"
          type="password"
          autoComplete="new-password"
          value={values.confirm}
          onChange={update('confirm')}
          required
        />
      </label>

      <div className="od-acct__actions">
        <button type="submit" className="od-cbtn od-cbtn--primary" disabled={busy}>
          {busy ? 'Saving…' : 'Change password'}
        </button>
      </div>
    </form>
  )
}

/* ---------------------------------------------------------------- invites */

function InvitesPanel(): ReactNode {
  const [state, setState] = useState<ListInvitesResponse | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setState(await listInvites({ signal }))
    } catch (err) {
      if (signal?.aborted) return
      setError(messageOf(err, 'Could not load your invites.'))
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setDone('')
    try {
      const data = await createInvite(email.trim() ? { email: email.trim() } : {})
      setEmail('')
      setDone(
        data.emailed
          ? 'Invite created and emailed.'
          : 'Invite created. Copy the link below and pass it on.',
      )
      await load()
    } catch (err) {
      setError(messageOf(err, 'Could not create the invite.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleRevoke(token: string) {
    setError('')
    setDone('')
    try {
      await revokeInvite(token)
      await load()
    } catch (err) {
      setError(messageOf(err, 'Could not revoke that invite.'))
    }
  }

  if (!state) {
    return (
      <>
        <Note tone="error">{error}</Note>
        {error ? null : <PageStatus loading inline className="od-acct__empty" />}
      </>
    )
  }

  return (
    <>
      <Note tone="error">{error}</Note>
      <Note tone="good">{done}</Note>

      <form onSubmit={handleCreate}>
        <label className="od-acct__field">
          <span className="od-acct__label">Email address (optional)</span>
          <input
            className="od-acct__input"
            type="email"
            placeholder="someone@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <p className="od-acct__hint">
          {/* The honest version of "invites need SMTP". They never did — the
              link works pasted into a chat window, and only the delivery of it
              needed a mail server. */}
          {state.smtp_enabled
            ? 'Leave this blank to create a link you can pass on yourself instead of sending mail.'
            : 'Email is not configured on this server, so invites are created as links for you to pass on.'}
          {state.site_url_configured
            ? ' Recipients open the link and create their own account.'
            : ' Links use the address you are browsing from until a public site URL is set in admin settings. Recipients open the link and create their own account.'}
        </p>

        <div className="od-acct__actions">
          <button
            type="submit"
            className="od-cbtn od-cbtn--primary"
            disabled={busy || (!state.unlimited && (state.remaining ?? 0) <= 0)}
          >
            {busy ? 'Creating…' : email.trim() ? 'Send invite' : 'Create invite link'}
          </button>
          <span className="od-acct__hint">
            {state.unlimited
              ? `Unlimited invites · links last ${state.ttl_hours} hours`
              : `${state.remaining} of ${state.quota} invites left · links last ${state.ttl_hours} hours`}
          </span>
        </div>
      </form>

      <ul className="od-acct__list od-acct__list--follow">
        {state.invites.length === 0 ? (
          <p className="od-acct__empty">No open invites.</p>
        ) : (
          state.invites.map((invite) => (
            <li key={invite.token} className="od-acct__row">
              <div className="od-acct__row-main">
                <p className="od-acct__row-title">{invite.email || 'Link invite'}</p>
                <p className={`od-acct__row-sub${invite.expired ? ' od-acct__row-sub--warn' : ''}`}>
                  {invite.expired
                    ? `Expired ${formatWhen(invite.expires_at)}`
                    : `Expires ${formatWhen(invite.expires_at)}`}
                </p>
                <code className="od-acct__link">{invite.url}</code>
              </div>
              <button type="button" className="od-cbtn" onClick={() => copyText(invite.url)}>
                Copy link
              </button>
              <button type="button" className="od-cbtn" onClick={() => handleRevoke(invite.token)}>
                Revoke
              </button>
            </li>
          ))
        )}
      </ul>
    </>
  )
}

/* ----------------------------------------------------------------- tokens */

type ScopePresetId = 'companion' | 'thin'

function TokensPanel(): ReactNode {
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [name, setName] = useState('')
  const [preset, setPreset] = useState<ScopePresetId>('companion')
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await listTokens({ signal })
      setTokens(Array.isArray(data.tokens) ? data.tokens : [])
    } catch (err) {
      if (signal?.aborted) return
      setError(messageOf(err, 'Could not load your tokens.'))
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !name.trim()) return
    setBusy(true)
    setError('')
    try {
      const data = await createToken({ name: name.trim(), preset })
      setSecret(extractOneTimeSecret(data))
      setName('')
      await load()
    } catch (err) {
      setError(messageOf(err, 'Could not create that token.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleRevoke(id: number) {
    setError('')
    try {
      await revokeToken(id)
      await load()
    } catch (err) {
      setError(messageOf(err, 'Could not revoke that token.'))
    }
  }

  return (
    <>
      <Note tone="error">{error}</Note>

      {secret ? (
        <div className="od-acct__note od-acct__note--good" role="status">
          <p style={{ margin: 0 }}>Copy this now — it is not shown again.</p>
          <code className="od-acct__link">{secret}</code>
          <div className="od-acct__actions">
            <button type="button" className="od-cbtn" onClick={() => copyText(secret)}>
              Copy token
            </button>
            <button type="button" className="od-cbtn" onClick={() => setSecret('')}>
              Done
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleCreate}>
        <label className="od-acct__field">
          <span className="od-acct__label">Token name</span>
          <input
            className="od-acct__input"
            value={name}
            placeholder="Living room companion"
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>

        <label className="od-acct__field">
          <span className="od-acct__label">Scope preset</span>
          <select
            className="od-acct__input"
            value={preset}
            onChange={(event) => setPreset(event.target.value as ScopePresetId)}
          >
            <option value="companion">Desktop companion — library + download</option>
            <option value="thin">Thin client — library + social, no download</option>
          </select>
        </label>

        <div className="od-acct__actions">
          <button
            type="submit"
            className="od-cbtn od-cbtn--primary"
            disabled={busy || !name.trim()}
          >
            {busy ? 'Creating…' : 'Create token'}
          </button>
        </div>
      </form>

      <ul className="od-acct__list od-acct__list--follow">
        {tokens.length === 0 ? (
          <p className="od-acct__empty">No tokens yet.</p>
        ) : (
          tokens.map((token) => (
            <li key={token.id} className="od-acct__row">
              <div className="od-acct__row-main">
                <p className="od-acct__row-title">{token.name}</p>
                <p className="od-acct__row-sub">
                  {token.token_prefix ? `${token.token_prefix}… · ` : ''}
                  created {formatWhen(token.created_at)}
                </p>
              </div>
              <button type="button" className="od-cbtn" onClick={() => handleRevoke(token.id)}>
                Revoke
              </button>
            </li>
          ))
        )}
      </ul>
    </>
  )
}

/* ------------------------------------------------------------------ shell */

export interface AccountModalProps {
  /** Which section to open on. A falsy value keeps the modal closed. */
  panel?: AccountPanelId | null
  onClose?: () => void
  onAvatarChange?: (path: string) => void
}

export function AccountModal({ panel, onClose, onAvatarChange }: AccountModalProps): ReactNode {
  const [active, setActive] = useState<AccountPanelId>(() =>
    isPanelId(panel) ? panel : 'profile',
  )
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
