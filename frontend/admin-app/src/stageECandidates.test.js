import {
  hasStageEHints,
  normalizeStageECandidates,
  normalizeStageEMeta,
  stageEChipSources,
  stageEMatchModeLabel,
  stageESourceLabel,
} from './stageECandidates'

test('normalizeStageECandidates soft-degrades when fields absent', () => {
  expect(normalizeStageECandidates(null)).toEqual([])
  expect(normalizeStageECandidates({})).toEqual([])
  expect(normalizeStageECandidates({ suggested_candidate_name: 'Doom' })).toEqual([])
  expect(normalizeStageECandidates({ stage_e_candidates: [] })).toEqual([])
  expect(normalizeStageECandidates({ stage_e_candidates: null })).toEqual([])
})

test('normalizeStageECandidates reads flattened list API field', () => {
  const hits = normalizeStageECandidates({
    stage_e_candidates: [
      {
        source: 'mobygames',
        id: 42,
        name: 'Doom',
        url: 'https://www.mobygames.com/game/42',
        cover_url: '',
        match_mode: 'moby_exact',
        propose_only: true,
        identify_path: 'stage_e',
      },
      null,
      'skip',
    ],
  })
  expect(hits).toHaveLength(1)
  expect(hits[0].name).toBe('Doom')
  expect(hits[0].source).toBe('mobygames')
  expect(hits[0].match_mode).toBe('moby_exact')
  expect(hits[0].propose_only).toBe(true)
})

test('normalizeStageECandidates reads nested proposal.proposal body', () => {
  const hits = normalizeStageECandidates({
    proposal: {
      proposal: {
        stage_e_candidates: [
          {
            source: 'thegamesdb',
            thegamesdb_id: 99,
            name: 'Tetris',
            match_mode: 'tgdb_exact',
            propose_only: true,
          },
        ],
      },
    },
  })
  expect(hits).toHaveLength(1)
  expect(hits[0].name).toBe('Tetris')
  expect(hits[0].id).toBe('99')
  expect(hits[0].source).toBe('thegamesdb')
})

test('normalizeStageEMeta soft-degrades and reads meta', () => {
  expect(normalizeStageEMeta(null)).toBeNull()
  expect(normalizeStageEMeta({})).toBeNull()
  expect(
    normalizeStageEMeta({
      stage_e: {
        match_reason: 'stage_e_moby_exact',
        identify_path: 'stage_e',
        skipped: ['tgdb_pc_skipped'],
        propose_only: true,
      },
    }),
  ).toEqual({
    match_reason: 'stage_e_moby_exact',
    identify_path: 'stage_e',
    skipped: ['tgdb_pc_skipped'],
    propose_only: true,
  })
})

test('hasStageEHints does not infer from suggested_candidate_name alone', () => {
  expect(hasStageEHints({ suggested_candidate_name: 'Doom' })).toBe(false)
  expect(hasStageEHints({ identify_path: 'stage_e' })).toBe(true)
  expect(hasStageEHints({ match_reason: 'stage_e_moby_exact' })).toBe(true)
  expect(
    hasStageEHints({
      stage_e_candidates: [{ source: 'moby', name: 'Doom', match_mode: 'moby_exact' }],
    }),
  ).toBe(true)
})

test('stageE labels map sources and match modes', () => {
  expect(stageESourceLabel('mobygames')).toBe('MobyGames')
  expect(stageESourceLabel('tgdb')).toBe('TheGamesDB')
  expect(stageEMatchModeLabel('moby_exact_ambiguous')).toBe('Ambiguous')
  expect(stageEChipSources([
    { source: 'mobygames' },
    { source: 'moby' },
    { source: 'thegamesdb' },
  ])).toEqual(['MobyGames', 'TheGamesDB'])
})
