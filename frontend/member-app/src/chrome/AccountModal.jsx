import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  changePassword,
  chooseStockAvatar,
  createInvite,
  getAccountSummary,
  listInvites,
  revokeInvite,
  uploadAvatar,
} from '../api/account'
import { createToken, extractOneTimeSecret, listTokens, revokeToken } from '../api/tokens'
import { copyText } from '../utils/copyText'
import { PageStatus } from '../components/PageStatus'
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

export const ACCOUNT_PANELS = [
  { id: 'profile', label: 'Profile', title: 'Profile' },
  { id: 'avatar', label: 'Avatar', title: 'Change avatar' },
  { id: 'password', label: 'Password', title: 'Change password' },
  { id: 'invites', label: 'Invites', title: 'Invites' },
  { id: 'tokens', label: 'API tokens', title: 'API tokens' },
]

const PANEL_IDS = new Set(ACCOUNT_PANELS.map((panel) => panel.id))

function panelTitle(id) {
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
function avatarSrc(summary, path) {
  const resolved = summary?.avatar_url
  if (resolved && (!path || path === summary?.avatar_path)) return resolved
  if (!path) return ''
  return path.startsWith('/') ? path : `/static/${path}`
}

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return String(iso)
  }
}

/** Read `error` off a thrown envelope error without leaking `[object Object]`. */
function messageOf(error, fallback) {
  const text = error && typeof error.message === 'string' ? error.message.trim() : ''
  return text || fallback
}

function Note({ tone, children }) {
  if (!children) return null
  return (
    <p className={`gt-acct__note gt-acct__note--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
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
function ProfilePanel({ summary }) {
  if (!summary) return <PageStatus loading className="gt-acct__empty" />

  return (
    <div className="gt-acct__avatar-row">
      <img
        className="gt-acct__avatar"
        src={avatarSrc(summary, summary.avatar_path)}
        alt=""
      />
      <div className="gt-acct__avatar-meta">
        <p className="gt-acct__row-title">{summary.username}</p>
        <p className="gt-acct__row-sub">{summary.role}</p>
        {/* An emailless household account shows what it is rather than a
            placeholder address nobody can write to. */}
        <p className="gt-acct__row-sub">{summary.email || 'No email on this account'}</p>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- avatar */

function AvatarPanel({ summary, onUpdated }) {
  const [file, setFile] = useState(null)
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

  async function handleSubmit(event) {
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

  async function handleStock(id) {
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

      <div className="gt-acct__avatar-row">
        <img className="gt-acct__avatar" src={shown} alt="" />
        <div className="gt-acct__avatar-meta">
          <input
            id="gt-acct-avatar-file"
            className="gt-acct__file"
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null)
              setDone('')
              setError('')
            }}
          />
          <label className="gt-cbtn gt-acct__file-label" htmlFor="gt-acct-avatar-file">
            Choose image
          </label>
          <p className="gt-acct__hint">
            PNG, JPEG, GIF or WebP, up to 5MB. Square crops best — anything else
            is centred and cropped for you.
          </p>
          {file ? <p className="gt-acct__hint">{file.name}</p> : null}
        </div>
      </div>

      <div className="gt-acct__actions">
        <button type="submit" className="gt-cbtn gt-cbtn--primary" disabled={!file || busy}>
          {busy ? 'Uploading…' : 'Save avatar'}
        </button>
        {file ? (
          <button type="button" className="gt-cbtn" onClick={() => setFile(null)} disabled={busy}>
            Cancel
          </button>
        ) : null}
      </div>

      {/* Stock picks, so having no picture to hand is not a dead end.
          Applied on click rather than staged behind Save: there is nothing to
          review — the tile you clicked is exactly what you get. */}
      {stock.length > 0 ? (
        <>
          <p className="gt-acct__label gt-acct__label--follow">
            Or pick one
          </p>
          <ul className="gt-acct__stock">
            {stock.map((entry) => {
              const selected = summary?.avatar_path === entry.path
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    className="gt-acct__stock-btn"
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

function PasswordPanel() {
  const [values, setValues] = useState({ current: '', next: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  function update(key) {
    return (event) => {
      setValues((previous) => ({ ...previous, [key]: event.target.value }))
      setError('')
      setDone('')
    }
  }

  async function handleSubmit(event) {
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

      <label className="gt-acct__field">
        <span className="gt-acct__label">Current password</span>
        <input
          className="gt-acct__input"
          type="password"
          autoComplete="current-password"
          value={values.current}
          onChange={update('current')}
          required
        />
      </label>

      <label className="gt-acct__field">
        <span className="gt-acct__label">New password</span>
        <input
          className="gt-acct__input"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={values.next}
          onChange={update('next')}
          required
        />
      </label>

      <label className="gt-acct__field">
        <span className="gt-acct__label">Confirm new password</span>
        <input
          className="gt-acct__input"
          type="password"
          autoComplete="new-password"
          value={values.confirm}
          onChange={update('confirm')}
          required
        />
      </label>

      <div className="gt-acct__actions">
        <button type="submit" className="gt-cbtn gt-cbtn--primary" disabled={busy}>
          {busy ? 'Saving…' : 'Change password'}
        </button>
      </div>
    </form>
  )
}

/* ---------------------------------------------------------------- invites */

function InvitesPanel() {
  const [state, setState] = useState(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const load = useCallback(async (signal) => {
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

  async function handleCreate(event) {
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

  async function handleRevoke(token) {
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
        {error ? null : <PageStatus loading className="gt-acct__empty" />}
      </>
    )
  }

  return (
    <>
      <Note tone="error">{error}</Note>
      <Note tone="good">{done}</Note>

      <form onSubmit={handleCreate}>
        <label className="gt-acct__field">
          <span className="gt-acct__label">Email address (optional)</span>
          <input
            className="gt-acct__input"
            type="email"
            placeholder="someone@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <p className="gt-acct__hint">
          {/* The honest version of "invites need SMTP". They never did — the
              link works pasted into a chat window, and only the delivery of it
              needed a mail server. */}
          {state.smtp_enabled
            ? 'Leave this blank to create a link you can pass on yourself instead of sending mail.'
            : 'Email is not configured on this server, so invites are created as links for you to pass on.'}
          {state.site_url_configured
            ? ''
            : ' Set the site URL in admin settings, or the link will point at 127.0.0.1.'}
        </p>

        <div className="gt-acct__actions">
          <button
            type="submit"
            className="gt-cbtn gt-cbtn--primary"
            disabled={busy || state.remaining <= 0}
          >
            {busy ? 'Creating…' : email.trim() ? 'Send invite' : 'Create invite link'}
          </button>
          <span className="gt-acct__hint">
            {state.remaining} of {state.quota} invites left · links last{' '}
            {state.ttl_hours} hours
          </span>
        </div>
      </form>

      <ul className="gt-acct__list gt-acct__list--follow">
        {state.invites.length === 0 ? (
          <p className="gt-acct__empty">No open invites.</p>
        ) : (
          state.invites.map((invite) => (
            <li key={invite.token} className="gt-acct__row">
              <div className="gt-acct__row-main">
                <p className="gt-acct__row-title">{invite.email || 'Link invite'}</p>
                <p
                  className={`gt-acct__row-sub${invite.expired ? ' gt-acct__row-sub--warn' : ''}`}
                >
                  {invite.expired
                    ? `Expired ${formatWhen(invite.expires_at)}`
                    : `Expires ${formatWhen(invite.expires_at)}`}
                </p>
                <code className="gt-acct__link">{invite.url}</code>
              </div>
              <button type="button" className="gt-cbtn" onClick={() => copyText(invite.url)}>
                Copy link
              </button>
              <button type="button" className="gt-cbtn" onClick={() => handleRevoke(invite.token)}>
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

function TokensPanel() {
  const [tokens, setTokens] = useState([])
  const [name, setName] = useState('')
  const [preset, setPreset] = useState('companion')
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (signal) => {
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

  async function handleCreate(event) {
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

  async function handleRevoke(id) {
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
        <div className="gt-acct__note gt-acct__note--good" role="status">
          <p style={{ margin: 0 }}>Copy this now — it is not shown again.</p>
          <code className="gt-acct__link">{secret}</code>
          <div className="gt-acct__actions">
            <button type="button" className="gt-cbtn" onClick={() => copyText(secret)}>
              Copy token
            </button>
            <button type="button" className="gt-cbtn" onClick={() => setSecret('')}>
              Done
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleCreate}>
        <label className="gt-acct__field">
          <span className="gt-acct__label">Token name</span>
          <input
            className="gt-acct__input"
            value={name}
            placeholder="Living room companion"
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>

        <label className="gt-acct__field">
          <span className="gt-acct__label">Scope preset</span>
          <select
            className="gt-acct__input"
            value={preset}
            onChange={(event) => setPreset(event.target.value)}
          >
            <option value="companion">Desktop companion — library + download</option>
            <option value="thin">Thin client — library + social, no download</option>
          </select>
        </label>

        <div className="gt-acct__actions">
          <button type="submit" className="gt-cbtn gt-cbtn--primary" disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create token'}
          </button>
        </div>
      </form>

      <ul className="gt-acct__list gt-acct__list--follow">
        {tokens.length === 0 ? (
          <p className="gt-acct__empty">No tokens yet.</p>
        ) : (
          tokens.map((token) => (
            <li key={token.id} className="gt-acct__row">
              <div className="gt-acct__row-main">
                <p className="gt-acct__row-title">{token.name}</p>
                <p className="gt-acct__row-sub">
                  {token.token_prefix ? `${token.token_prefix}… · ` : ''}
                  created {formatWhen(token.created_at)}
                </p>
              </div>
              <button type="button" className="gt-cbtn" onClick={() => handleRevoke(token.id)}>
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

export function AccountModal({ panel, onClose, onAvatarChange }) {
  const [active, setActive] = useState(() => (PANEL_IDS.has(panel) ? panel : 'profile'))
  const [summary, setSummary] = useState(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (PANEL_IDS.has(panel)) setActive(panel)
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
    function onKey(event) {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [panel, onClose])

  function handleAvatarUpdated(path) {
    setSummary((previous) => (previous ? { ...previous, avatar_path: path } : previous))
    onAvatarChange?.(path)
  }

  if (!panel) return null

  const body = (
    <div
      className="gt-acct__scrim"
      role="presentation"
      onMouseDown={(event) => {
        // Only a press that both starts and ends on the scrim dismisses:
        // otherwise a drag-select that ends outside the panel closes the modal
        // and throws away whatever was typed.
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <div
        className="gt-acct"
        data-panel={active}
        role="dialog"
        aria-modal="true"
        aria-label={panelTitle(active)}
        ref={panelRef}
      >
        <button type="button" className="gt-acct__close" aria-label="Close" onClick={onClose}>
          ×
        </button>

        <header className="gt-acct__head">
          <p className="gt-acct__eyebrow">Account</p>
          <h2 className="gt-acct__title">{panelTitle(active)}</h2>
          {summary ? (
            <p className="gt-acct__lede">
              {summary.username}
              {summary.role ? ` · ${summary.role}` : ''}
            </p>
          ) : null}
        </header>

        {/* Separate `.gt-cbtn` buttons, not one joined `.gt-seg` pill.
            A segmented control says "these are mutually exclusive views of one
            thing" and draws a single outline around the set, which read as a box
            wrapped around a box inside the panel. These are five destinations,
            the same kind of thing the top bar's buttons are, so they wear the
            same clothes — and they pack left, because a modal reads top-left to
            bottom-right and there is nothing to centre them against. */}
        <div className="gt-acct__tabs" role="group" aria-label="Account sections">
          {ACCOUNT_PANELS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`gt-cbtn${entry.id === active ? ' is-on' : ''}`}
              aria-pressed={entry.id === active}
              onClick={() => setActive(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="gt-acct__body">
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
