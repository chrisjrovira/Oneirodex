import { useEffect, useState } from 'react'
import { Button } from '@oneirodex/ui'
import {
  type FilterField,
  type FilterGroup,
  type FilterNode,
  isGroup,
} from '../../api/savedFilters'

/**
 * Edit a nested AND / OR / NOT filter (INSP-3).
 *
 * The chip row can only ever mean *and*, so a question like "VR titles that are
 * behind, or anything imported this fortnight" has no expression there. This is
 * the face of the tree the backend already compiles.
 *
 * The field list comes from the server (`/api/filters/fields`) rather than a
 * copy kept here: the tree can only name fields the chip row already offers,
 * and a second list in the SPA is one that goes stale the day a field is added.
 */

const OPS: { op: FilterGroup['op']; label: string; hint: string }[] = [
  { op: 'and', label: 'All of', hint: 'every row below has to match' },
  { op: 'or', label: 'Any of', hint: 'one row below is enough' },
  { op: 'not', label: 'None of', hint: 'a row below rules a title out' },
]

/** Human wording for a field, so the builder does not read like a schema. */
const FIELD_LABELS: Record<string, string> = {
  is_vr: 'Plays in VR',
  vr_compat: 'Headset support',
  freshness_behind: 'Behind the latest version',
  has_updates: 'Has an update waiting',
  new_import: 'Added recently',
  recent_release: 'Released recently',
  needs_translation: 'Needs a translation',
  path_missing: 'Files missing from disk',
  path_status: 'File status',
  item_kind: 'Kind',
  name: 'Title contains',
}

export function fieldLabel(field: string) {
  return FIELD_LABELS[field] || field.replace(/_/g, ' ')
}

/** A leaf's starting value, so adding a row never yields one the server refuses. */
function emptyValue(field: FilterField) {
  if (field.kind === 'flag') return true
  if (field.kind === 'text') return ''
  if (field.kind === 'enum') return field.values?.[0] ?? ''
  return field.values?.length ? [field.values[0]] : []
}

function replaceAt(nodes: FilterNode[], index: number, next: FilterNode): FilterNode[] {
  return nodes.map((node, i) => (i === index ? next : node))
}

export function FilterBuilder({
  value,
  fields,
  onChange,
  errorPath = '',
  path = 'root',
  onRemove,
  t = (key: string) => key,
}: {
  value: FilterNode
  fields: FilterField[]
  onChange: (next: FilterNode) => void
  /** Dotted path the server rejected, e.g. `root.1.0`. */
  errorPath?: string
  path?: string
  onRemove?: () => void
  t?: (key: string) => string
}) {
  const flagged = errorPath === path

  if (!isGroup(value)) {
    const field = fields.find((f) => f.field === value.field)
    return (
      <div className="od-fb-leaf" data-path={path} data-flagged={flagged ? 'true' : undefined}>
        <select
          className="od-fb-field"
          aria-label={t('Field')}
          value={value.field}
          onChange={(event) => {
            const next = fields.find((f) => f.field === event.target.value)
            if (!next) return
            onChange({ field: next.field, value: emptyValue(next) })
          }}
        >
          {fields.map((f) => (
            <option key={f.field} value={f.field}>
              {fieldLabel(f.field)}
            </option>
          ))}
        </select>

        <LeafValue
          field={field}
          value={value.value}
          onChange={(next) => onChange({ field: value.field, value: next })}
          t={t}
        />

        {onRemove ? (
          <Button variant="ghost" size="sm" onClick={onRemove} aria-label={t('Remove this row')}>
            ×
          </Button>
        ) : null}
      </div>
    )
  }

  const group = value
  return (
    <div className="od-fb-group" data-path={path} data-flagged={flagged ? 'true' : undefined}>
      <div className="od-fb-group-head">
        <select
          className="od-fb-op"
          aria-label={t('How these combine')}
          value={group.op}
          onChange={(event) => onChange({ ...group, op: event.target.value as FilterGroup['op'] })}
        >
          {OPS.map((entry) => (
            <option key={entry.op} value={entry.op}>
              {t(entry.label)}
            </option>
          ))}
        </select>
        <span className="od-fb-hint">{t(OPS.find((o) => o.op === group.op)?.hint ?? '')}</span>
        {onRemove ? (
          <Button variant="ghost" size="sm" onClick={onRemove} aria-label={t('Remove this group')}>
            ×
          </Button>
        ) : null}
      </div>

      <div className="od-fb-children">
        {group.nodes.map((child, index) => (
          <FilterBuilder
            key={index}
            value={child}
            fields={fields}
            path={`${path}.${index}`}
            errorPath={errorPath}
            t={t}
            onChange={(next) => onChange({ ...group, nodes: replaceAt(group.nodes, index, next) })}
            onRemove={
              group.nodes.length > 1
                ? () => onChange({ ...group, nodes: group.nodes.filter((_, i) => i !== index) })
                : undefined
            }
          />
        ))}
      </div>

      <div className="od-fb-group-actions">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const first = fields[0]
            if (!first) return
            onChange({
              ...group,
              nodes: [...group.nodes, { field: first.field, value: emptyValue(first) }],
            })
          }}
        >
          {t('Add a row')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const first = fields[0]
            if (!first) return
            onChange({
              ...group,
              nodes: [
                ...group.nodes,
                { op: 'or', nodes: [{ field: first.field, value: emptyValue(first) }] },
              ],
            })
          }}
        >
          {t('Add a group')}
        </Button>
      </div>
    </div>
  )
}

function LeafValue({
  field,
  value,
  onChange,
  t,
}: {
  field: FilterField | undefined
  value: boolean | string | string[]
  onChange: (next: boolean | string | string[]) => void
  t: (key: string) => string
}) {
  if (!field) return null

  if (field.kind === 'flag') {
    // Yes / No rather than a checkbox: unticking a checkbox reads as "I don't
    // care about this", but the server treats a false flag as *not this*. A
    // two-option select says which one the member is choosing.
    return (
      <select
        className="od-fb-value"
        aria-label={t('Value')}
        value={value === false ? 'no' : 'yes'}
        onChange={(event) => onChange(event.target.value === 'yes')}
      >
        <option value="yes">{t('Yes')}</option>
        <option value="no">{t('No')}</option>
      </select>
    )
  }

  if (field.kind === 'text') {
    return (
      <input
        className="od-fb-value"
        type="text"
        aria-label={t('Value')}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
      />
    )
  }

  if (field.kind === 'enum') {
    return (
      <select
        className="od-fb-value"
        aria-label={t('Value')}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
      >
        {(field.values ?? []).map((option) => (
          <option key={option} value={option}>
            {option.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    )
  }

  const selected = Array.isArray(value) ? value : []
  return (
    <span className="od-fb-multi">
      {(field.values ?? []).map((option) => (
        <label key={option} className="od-fb-multi-option">
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={(event) =>
              onChange(
                event.target.checked ? [...selected, option] : selected.filter((v) => v !== option),
              )
            }
          />
          {option}
        </label>
      ))}
    </span>
  )
}

/** Load the field list once; a builder with no fields can offer nothing. */
export function useFilterFields(load: (signal?: AbortSignal) => Promise<FilterField[]>) {
  const [fields, setFields] = useState<FilterField[]>([])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
      .then(setFields)
      .catch((error: Error) => {
        if (error.name !== 'AbortError') setFailed(true)
      })
    return () => controller.abort()
  }, [load])

  return { fields, failed }
}
