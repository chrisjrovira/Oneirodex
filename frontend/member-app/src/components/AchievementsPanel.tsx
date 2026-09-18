import { useEffect, useState } from 'react'
import { Button } from '@oneirodex/ui'
import {
  fetchGameAchievements,
  saveRetroAchievementsUsername,
  type GameAchievementsResponse,
} from '../api/achievements'
import { showToast } from '../utils/toast'
import { PageStatus } from './PageStatus'
import './AchievementsPanel.css'

/**
 * Game details — the RetroAchievements set matched to this ROM, and this
 * member's progress once they enter their RA username.
 *
 * Two honesty rules the copy has to keep:
 *
 * 1. Nothing played in Oneirodex's browser player unlocks anything. There is
 *    no rcheevos runtime in the WASM shell, so the list is a *checklist of
 *    what exists*, plus whatever the member earned elsewhere.
 * 2. The section only renders for a set that actually carries achievements
 *    (`supports_achievements`, R2). A matched set with none is not a promise.
 */
export function AchievementsPanel({ gameUuid }: { gameUuid: string }) {
  const [data, setData] = useState<GameAchievementsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [nameDraft, setNameDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (!gameUuid) return undefined
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError(null)
    fetchGameAchievements(gameUuid, { signal: controller.signal })
      .then((body) => {
        if (!active) return
        setData(body)
        setNameDraft(body.ra_username || '')
        setLoading(false)
      })
      .catch((err: { name?: string }) => {
        if (!active || err?.name === 'AbortError') return
        setError(err)
        setLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [gameUuid, reloadTick])

  // Nothing matched (or the server has no credentials): no section at all,
  // rather than an empty promise on every title in the library.
  if (!loading && !error && !data?.supports_achievements) return null

  async function handleSaveName(event: { preventDefault: () => void }) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await saveRetroAchievementsUsername(nameDraft.trim())
      showToast(
        nameDraft.trim()
          ? 'RetroAchievements username saved.'
          : 'RetroAchievements username cleared.',
        'success',
      )
      setReloadTick((n) => n + 1)
    } catch (err) {
      showToast((err as Error)?.message || 'Could not save that username.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const me = data?.me || null
  const rows = me?.achievements || []
  const visible = showAll ? rows : rows.slice(0, 12)

  return (
    <section
      className="od-details-page__section od-achievements"
      id="achievements"
      aria-labelledby="achievements-head"
    >
      <h2 id="achievements-head">Achievements</h2>
      <PageStatus
        loading={loading}
        loadingMessage="Reading achievements…"
        error={error}
        onRetry={() => setReloadTick((n) => n + 1)}
        errorMessage="Could not read achievements."
        inline
      />
      {loading || error || !data ? null : (
        <>
          <p className="od-achievements__lede">
            This title has a community set of <strong>{data.ra_achievements}</strong> achievements
            on RetroAchievements
            {data.ra_url ? (
              <>
                {' '}
                (
                <a href={data.ra_url} target="_blank" rel="noreferrer noopener">
                  view the set
                </a>
                )
              </>
            ) : null}
            . Playing here does not unlock them — the browser player has no achievement runtime — so
            this is what exists to earn, plus anything you have already earned elsewhere.
          </p>

          {me ? (
            <>
              <p className="od-achievements__progress">
                <strong>{me.earned}</strong> of {me.total} earned as {me.username}
                {me.completion ? ` · ${me.completion}` : ''}
                {me.earned_hardcore ? ` · ${me.earned_hardcore} hardcore` : ''}
              </p>
              <ul className="od-achievements__list">
                {visible.map((row) => (
                  <li
                    key={row.id}
                    className="od-achievements__row"
                    data-earned={row.earned ? 'true' : 'false'}
                  >
                    <img
                      className="od-achievements__badge"
                      src={row.badge_url}
                      alt=""
                      width={40}
                      height={40}
                      loading="lazy"
                    />
                    <span className="od-achievements__text">
                      <strong className="od-achievements__title">{row.title}</strong>
                      <span className="od-achievements__desc">{row.description}</span>
                    </span>
                    <span className="od-achievements__points">
                      {row.points}
                      <span className="visually-hidden"> points</span>
                      {row.earned ? (
                        <span className="od-achievements__earned" title="Earned">
                          {' '}
                          ✓
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
              {rows.length > visible.length ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAll(true)}>
                  Show all {rows.length}
                </Button>
              ) : null}
            </>
          ) : (
            <form className="od-achievements__form" onSubmit={handleSaveName}>
              <label htmlFor="ra-username">RetroAchievements username</label>
              <input
                id="ra-username"
                type="text"
                maxLength={64}
                autoComplete="off"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                placeholder="your RA handle"
              />
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                Save
              </Button>
              <span className="od-achievements__hint">
                Your public handle only — never a password or key. It is used to read your progress.
              </span>
            </form>
          )}
        </>
      )}
    </section>
  )
}
