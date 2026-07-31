import {
  batchItemUuids,
  countBatchItems,
  summarizeBatchOutcome,
} from './batchOutcome'

test('countBatchItems and batchItemUuids handle strings and objects', () => {
  expect(countBatchItems(undefined)).toBe(0)
  expect(countBatchItems(['a', 'b'])).toBe(2)
  expect(batchItemUuids(['a', { uuid: 'b' }, { uuid: '' }, null])).toEqual(['a', 'b'])
})

test('summarizeBatchOutcome builds honest counts and tone', () => {
  expect(
    summarizeBatchOutcome({
      updated: [{ uuid: 'a' }],
      skipped: [{ uuid: 'b', reason: 'already_set' }],
      errors: [],
    }),
  ).toMatchObject({
    message: '1 updated · 1 skipped · 0 failed',
    tone: 'success',
    updated: 1,
    skipped: 1,
    errors: 0,
  })

  expect(
    summarizeBatchOutcome(
      { updated: [], skipped: [], errors: [{ uuid: 'x', error: 'boom' }] },
      { actionLabel: 'Favorites' },
    ),
  ).toMatchObject({
    message: 'Favorites: 0 updated · 0 skipped · 1 failed',
    tone: 'error',
  })

  expect(
    summarizeBatchOutcome({
      updated: ['a'],
      skipped: [],
      errors: [{ uuid: 'b' }],
    }),
  ).toMatchObject({ tone: 'warn' })

  expect(
    summarizeBatchOutcome({
      updated: [],
      skipped: ['a', 'b'],
      errors: [],
    }),
  ).toMatchObject({ tone: 'info' })

  expect(
    summarizeBatchOutcome(
      {
        queued: [{ uuid: 'a' }, { uuid: 'b' }],
        skipped: [{ uuid: 'c', reason: 'no_igdb_id' }],
        errors: [],
      },
      { actionLabel: 'Refresh covers', successVerb: 'queued' },
    ),
  ).toMatchObject({
    message: 'Refresh covers: 2 queued · 1 skipped · 0 failed',
    tone: 'success',
    updated: 2,
  })
})
