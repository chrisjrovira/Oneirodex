import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { FilterBuilder } from './FilterBuilder'
import { SavedFilterPanel } from './SavedFilterPanel'
import type { FilterField, FilterNode } from '../../api/savedFilters'

const FIELDS: FilterField[] = [
  { field: 'is_vr', kind: 'flag' },
  { field: 'freshness_behind', kind: 'flag' },
  { field: 'name', kind: 'text' },
  { field: 'vr_compat', kind: 'enum', values: ['flat', 'injector_profile', 'native_vr'] },
  { field: 'item_kind', kind: 'enum_list', values: ['game', 'experience'] },
]

function Harness({ initial }: { initial: FilterNode }) {
  const [tree, setTree] = useState<FilterNode>(initial)
  return (
    <>
      <FilterBuilder value={tree} fields={FIELDS} onChange={setTree} />
      <pre data-testid="tree">{JSON.stringify(tree)}</pre>
    </>
  )
}

function tree() {
  return JSON.parse(screen.getByTestId('tree').textContent || '{}')
}

test('a group can be switched from all-of to any-of — the thing chips cannot say', async () => {
  const user = userEvent.setup()
  render(<Harness initial={{ op: 'and', nodes: [{ field: 'is_vr', value: true }] }} />)

  await user.selectOptions(screen.getByLabelText('How these combine'), 'or')

  expect(tree().op).toBe('or')
})

test('adding a row and a nested group builds the shape the server compiles', async () => {
  const user = userEvent.setup()
  render(<Harness initial={{ op: 'and', nodes: [{ field: 'is_vr', value: true }] }} />)

  await user.click(screen.getByRole('button', { name: 'Add a row' }))
  expect(tree().nodes).toHaveLength(2)

  await user.click(screen.getByRole('button', { name: 'Add a group' }))
  const added = tree().nodes[2]
  // A nested group defaults to `or`: nesting inside an `and` only earns its
  // keep when it means something the outer group cannot.
  expect(added.op).toBe('or')
  expect(added.nodes).toHaveLength(1)
})

test('the last row cannot be removed, so a group is never left empty', async () => {
  render(<Harness initial={{ op: 'and', nodes: [{ field: 'is_vr', value: true }] }} />)
  expect(screen.queryByRole('button', { name: 'Remove this row' })).toBeNull()
})

test('a flag row offers Yes / No rather than a checkbox', async () => {
  const user = userEvent.setup()
  render(<Harness initial={{ op: 'and', nodes: [{ field: 'freshness_behind', value: true }] }} />)

  // A false flag means *not this* on the server, not "ignore this" — an
  // unticked checkbox would read as the second.
  await user.selectOptions(screen.getByLabelText('Value'), 'no')
  expect(tree().nodes[0].value).toBe(false)
})

test('switching a row to another field replaces its value with one that field takes', async () => {
  const user = userEvent.setup()
  render(<Harness initial={{ op: 'and', nodes: [{ field: 'is_vr', value: true }] }} />)

  await user.selectOptions(screen.getByLabelText('Field'), 'vr_compat')
  expect(tree().nodes[0]).toEqual({ field: 'vr_compat', value: 'flat' })

  await user.selectOptions(screen.getByLabelText('Field'), 'item_kind')
  expect(tree().nodes[0]).toEqual({ field: 'item_kind', value: ['game'] })
})

test('the row the server rejected is the row that is marked', () => {
  const { container } = render(
    <FilterBuilder
      value={{
        op: 'and',
        nodes: [
          { field: 'is_vr', value: true },
          { field: 'name', value: 'zelda' },
        ],
      }}
      fields={FIELDS}
      onChange={() => {}}
      errorPath="root.1"
    />,
  )

  const flagged = container.querySelectorAll('[data-flagged="true"]')
  expect(flagged).toHaveLength(1)
  expect(flagged[0].getAttribute('data-path')).toBe('root.1')
})

// --- the panel --------------------------------------------------------------

vi.mock('../../api/savedFilters', async () => {
  const actual =
    await vi.importActual<typeof import('../../api/savedFilters')>('../../api/savedFilters')
  return {
    ...actual,
    fetchFilterFields: vi.fn(async () => FIELDS),
    fetchSavedFilters: vi.fn(async () => [
      {
        id: 7,
        name: 'Weekend',
        tree: { op: 'or', nodes: [{ field: 'is_vr', value: true }] },
        is_collection: false,
        created: null,
        updated: null,
      },
    ]),
    previewFilter: vi.fn(async () => ({ count: 12, sample: [] })),
  }
})

test('applying a saved filter hands its tree up, without touching the chips', async () => {
  const user = userEvent.setup()
  const onApply = vi.fn()
  render(<SavedFilterPanel onApply={onApply} />)

  const button = await screen.findByRole('button', { name: 'Weekend' })
  await user.click(button)

  expect(onApply).toHaveBeenCalledWith({ op: 'or', nodes: [{ field: 'is_vr', value: true }] })
})

test('the builder says how many titles match as it is built', async () => {
  const user = userEvent.setup()
  render(<SavedFilterPanel onApply={() => {}} />)

  await user.click(await screen.findByRole('button', { name: 'Build a filter' }))

  await waitFor(() => expect(screen.getByText(/12 titles match/)).toBeTruthy(), { timeout: 3000 })
})
