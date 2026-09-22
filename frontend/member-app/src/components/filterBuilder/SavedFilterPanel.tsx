import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@oneirodex/ui'
import {
  FilterTreeRejected,
  createSavedFilter,
  deleteSavedFilter,
  fetchFilterFields,
  fetchSavedFilters,
  previewFilter,
  updateSavedFilter,
  type FilterNode,
  type SavedFilter,
} from '../../api/savedFilters'
import { FilterBuilder, useFilterFields } from './FilterBuilder'

/**
 * Build a filter the chip row cannot express, and keep it under a name (INSP-3).
 *
 * Applying does not replace the chips — the tree rides beside them as
 * `filter_tree`, because a member who built a tree and then taps a chip means
 * both. Clearing is the chips' own Clear.
 */

const EMPTY_TREE: FilterNode = { op: 'and', nodes: [] }

function startingTree(field: string): FilterNode {
  return { op: 'and', nodes: [{ field, value: true }] }
}

export function SavedFilterPanel({
  activeTree,
  onApply,
  t = (key: string) => key,
}: {
  /** The tree currently applied to browse, if any. */
  activeTree?: FilterNode | null
  onApply: (tree: FilterNode | null) => void
  t?: (key: string) => string
}) {
  const load = useCallback((signal?: AbortSignal) => fetchFilterFields(signal), [])
  const { fields, failed } = useFilterFields(load)

  const [saved, setSaved] = useState<SavedFilter[]>([])
  const [tree, setTree] = useState<FilterNode>(activeTree ?? EMPTY_TREE)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [problem, setProblem] = useState('')
  const [errorPath, setErrorPath] = useState('')
  const [busy, setBusy] = useState(false)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchSavedFilters(controller.signal)
      .then(setSaved)
      .catch(() => {
        /* A member with no saved filters is the common case, not an error. */
      })
    return () => controller.abort()
  }, [])

  // Seed the builder once the field list lands, so "Build a filter" opens on a
  // usable row rather than an empty group the server would refuse.
  useEffect(() => {
    if (fields.length && tree === EMPTY_TREE) setTree(startingTree(fields[0].field))
  }, [fields, tree])

  /** Count as the filter is built — debounced, because it is a real query. */
  useEffect(() => {
    if (!open) return undefined
    if (previewTimer.current) clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => {
      previewFilter(tree)
        .then((result) => {
          setCount(result.count)
          setProblem('')
          setErrorPath('')
        })
        .catch((error: unknown) => {
          setCount(null)
          if (error instanceof FilterTreeRejected) {
            setProblem(error.message)
            setErrorPath(error.path)
          } else {
            setProblem((error as Error).message || t("Couldn't check that filter."))
            setErrorPath('')
          }
        })
    }, 400)
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current)
    }
  }, [tree, open, t])

  async function save() {
    if (!name.trim()) return
    setBusy(true)
    try {
      const row =
        editingId === null
          ? await createSavedFilter(name.trim(), tree)
          : await updateSavedFilter(editingId, { name: name.trim(), tree })
      setSaved((rows) => [...rows.filter((r) => r.id !== row.id), row].sort(byName))
      setEditingId(row.id)
      setProblem('')
      setErrorPath('')
    } catch (error: unknown) {
      if (error instanceof FilterTreeRejected) {
        setProblem(error.message)
        setErrorPath(error.path)
      } else {
        setProblem((error as Error).message || t("Couldn't save that filter."))
      }
    } finally {
      setBusy(false)
    }
  }

  async function remove(row: SavedFilter) {
    setBusy(true)
    try {
      await deleteSavedFilter(row.id)
      setSaved((rows) => rows.filter((r) => r.id !== row.id))
      if (editingId === row.id) setEditingId(null)
    } catch (error: unknown) {
      setProblem((error as Error).message || t("Couldn't delete that filter."))
    } finally {
      setBusy(false)
    }
  }

  if (failed) {
    // Honest rather than an empty builder that would refuse every row.
    return (
      <div className="od-fb-panel od-fb-panel--failed">
        {t('Saved filters are unavailable right now.')}
      </div>
    )
  }

  return (
    <div className="od-fb-panel">
      <div className="od-fb-saved">
        {saved.map((row) => (
          <span key={row.id} className="od-fb-saved-row">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setTree(row.tree)
                setName(row.name)
                setEditingId(row.id)
                onApply(row.tree)
              }}
            >
              {row.name}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              aria-label={`${t('Delete')} ${row.name}`}
              onClick={() => remove(row)}
            >
              ×
            </Button>
          </span>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? t('Close builder') : t('Build a filter')}
        </Button>
      </div>

      {open ? (
        <div className="od-fb-editor">
          <FilterBuilder
            value={tree}
            fields={fields}
            errorPath={errorPath}
            onChange={setTree}
            t={t}
          />

          <div className="od-fb-status" role="status">
            {problem ? (
              <span className="od-fb-problem">{problem}</span>
            ) : count === null ? (
              <span className="od-fb-count">{t('Checking…')}</span>
            ) : (
              <span className="od-fb-count">
                {count} {count === 1 ? t('title matches') : t('titles match')}
              </span>
            )}
          </div>

          <div className="od-fb-actions">
            <input
              className="od-fb-name"
              type="text"
              placeholder={t('Name this filter')}
              aria-label={t('Filter name')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Button variant="secondary" size="sm" disabled={busy || !name.trim()} onClick={save}>
              {editingId === null ? t('Save') : t('Update')}
            </Button>
            <Button variant="primary" size="sm" disabled={!!problem} onClick={() => onApply(tree)}>
              {t('Apply')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function byName(a: SavedFilter, b: SavedFilter) {
  return a.name.localeCompare(b.name)
}
