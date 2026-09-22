import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { chooseStockAvatar } from '../accountApi.js'
import type { AccountSummary } from '../accountApi.js'
import { accountClient, avatarSrc, messageOf } from './accountModalShared'
import { Note } from './AccountPanels'

/* AvatarPanel moved out of AccountModal (v11 cycle, H-D.2) — unchanged. */

export interface AvatarPanelProps {
  summary: AccountSummary | null
  onUpdated?: (path: string) => void
}

export function AvatarPanel({ summary, onUpdated }: AvatarPanelProps): ReactNode {
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
      const data = await accountClient.account.uploadAvatar(file)
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
