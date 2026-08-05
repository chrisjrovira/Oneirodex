import { render, screen } from '@testing-library/react'
import {
  booleanTone,
  healthTone,
  usageTone,
  formatLibraryHealthHint,
  formatLibraryHealthScore,
  formatLibraryHealthValue,
  formatLibraryWatchDetail,
  formatLibraryWatchStatus,
  issueFold,
  LibraryHealthFactors,
  libraryHealthFactorsGradeClass,
  libraryHealthTone,
  MetricStrip,
  MetricTile,
  normalizeLibraryHealth,
  partitionIssues,
  resolveBannerSeverity,
  severityLabel,
} from './opsWidgets'

describe('normalizeLibraryHealth / formatters', () => {
  test('null-safe when health absent', () => {
    expect(normalizeLibraryHealth(null)).toBeNull()
    expect(normalizeLibraryHealth(undefined)).toBeNull()
    expect(formatLibraryHealthValue(null)).toBe('n/a')
    expect(formatLibraryHealthHint(null)).toBe('not scored yet')
    expect(formatLibraryHealthScore({})).toBe('n/a')
    expect(libraryHealthTone(null)).toBe('na')
  })

  test('Wave 6 library.health shape', () => {
    const health = {
      score: 72.4,
      grade: 'fair',
      factors: [
        { id: 'missing_cover', label: 'Missing cover', count: 12, weight: 15 },
        { id: 'no_igdb', label: 'No IGDB', count: 5, weight: 10 },
        { id: 'unmatched', label: 'Unmatched folders', count: 3, weight: 8 },
      ],
    }
    expect(normalizeLibraryHealth(health)).toMatchObject({
      score: 72.4,
      grade: 'fair',
    })
    expect(formatLibraryHealthValue(health)).toBe('72 · fair')
    expect(formatLibraryHealthHint(health)).toBe('Missing cover · No IGDB')
    expect(libraryHealthTone(health)).toBe('fair')
  })

  test('honest poor + thin sample', () => {
    expect(formatLibraryHealthValue({ score: 31, grade: 'poor', factors: [], thin: true })).toBe(
      '31 · poor',
    )
    expect(formatLibraryHealthHint({ score: 31, grade: 'poor', factors: [], thin: true })).toBe(
      'sample thin',
    )
    expect(libraryHealthTone({ score: 31, grade: 'poor', factors: [], thin: true })).toBe('poor')
  })

  test('withheld score when thin / games=0', () => {
    const health = {
      score: null,
      grade: null,
      thin: true,
      games: 0,
      note: 'No games cataloged — score withheld.',
      factors: [{ id: 'unmatched', label: 'Unmatched folders', count: 2, weight: 20, deduction: 0 }],
    }
    expect(formatLibraryHealthValue(health)).toBe('n/a')
    expect(formatLibraryHealthHint(health)).toBe('Unmatched folders')
    expect(libraryHealthTone(health)).toBe('na')
  })

  test('ranks factors by deduction over API order', () => {
    const health = {
      score: 70,
      grade: 'fair',
      factors: [
        { id: 'missing_cover', label: 'Missing cover', count: 1, deduction: 2 },
        { id: 'no_igdb', label: 'No IGDB', count: 8, deduction: 16 },
      ],
    }
    expect(formatLibraryHealthHint(health, 1)).toBe('No IGDB')
  })

  test('defensive remap from average_score / top_issues', () => {
    const legacy = {
      average_score: 88,
      top_issues: [{ code: 'missing_cover', count: 4 }],
    }
    const n = normalizeLibraryHealth(legacy)
    expect(n.score).toBe(88)
    expect(n.grade).toBe('good')
    expect(n.factors[0].id).toBe('missing_cover')
    expect(formatLibraryHealthHint(legacy)).toBe('missing_cover')
    expect(libraryHealthTone(legacy)).toBe('good')
  })

  test('Wave 7 path-status / broken_path factor labels consume null-safe', () => {
    const health = {
      score: 55,
      grade: 'fair',
      factors: [
        { id: 'broken_path', label: 'Broken path', count: 2, weight: 20, deduction: 8 },
        { id: 'path_status', label: null, count: null, weight: null },
        null,
        { id: null, label: null },
      ],
    }
    const n = normalizeLibraryHealth(health)
    expect(n.factors).toHaveLength(2)
    expect(n.factors[0]).toMatchObject({ id: 'broken_path', label: 'Broken path', count: 2 })
    expect(n.factors[1]).toMatchObject({ id: 'path_status', label: 'path_status' })
    // Top hint prefers non-zero impact; null-label path_status still normalizes for display.
    expect(formatLibraryHealthHint(health)).toBe('Broken path')
    expect(libraryHealthTone(health)).toBe('fair')
  })

  test('libraryHealthTone maps good/fair/poor and stays na without grade', () => {
    expect(libraryHealthTone({ score: 90, grade: 'good', factors: [] })).toBe('good')
    expect(libraryHealthTone({ score: 60, grade: 'fair', factors: [] })).toBe('fair')
    expect(libraryHealthTone({ score: 20, grade: 'poor', factors: [] })).toBe('poor')
    expect(libraryHealthTone({ thin: true, factors: [] })).toBe('na')
    expect(libraryHealthTone({})).toBe('na')
  })
})

describe('LibraryHealthFactors grade edge cues', () => {
  test('libraryHealthFactorsGradeClass maps poor/fair only', () => {
    expect(libraryHealthFactorsGradeClass('poor')).toBe(' gt-ops-health-factors--poor')
    expect(libraryHealthFactorsGradeClass('fair')).toBe(' gt-ops-health-factors--fair')
    expect(libraryHealthFactorsGradeClass('good')).toBe('')
    expect(libraryHealthFactorsGradeClass(null)).toBe('')
  })

  test('adds poor/fair left-edge classes and leaves good unmarked', () => {
    const factors = [
      { id: 'missing_cover', label: 'Missing cover', count: 9 },
      { id: 'no_igdb', label: 'No IGDB', count: 4 },
    ]
    const { rerender } = render(
      <LibraryHealthFactors health={{ score: 28, grade: 'poor', factors }} />,
    )
    expect(screen.getByLabelText('Top health factors')).toHaveClass(
      'gt-ops-health-factors',
      'gt-ops-health-factors--poor',
    )
    expect(screen.getByLabelText('Top health factors')).not.toHaveClass(
      'gt-ops-health-factors--fair',
    )

    rerender(<LibraryHealthFactors health={{ score: 72, grade: 'fair', factors }} />)
    expect(screen.getByLabelText('Top health factors')).toHaveClass(
      'gt-ops-health-factors',
      'gt-ops-health-factors--fair',
    )
    expect(screen.getByLabelText('Top health factors')).not.toHaveClass(
      'gt-ops-health-factors--poor',
    )

    rerender(<LibraryHealthFactors health={{ score: 90, grade: 'good', factors }} />)
    expect(screen.getByLabelText('Top health factors')).not.toHaveClass(
      'gt-ops-health-factors--poor',
    )
    expect(screen.getByLabelText('Top health factors')).not.toHaveClass(
      'gt-ops-health-factors--fair',
    )
  })
})

describe('MetricTile tone class', () => {
  test('applies gt-ops-metric--{grade} and ignores unknown tone', () => {
    const { rerender, container } = render(
      <MetricTile label="Library health" value="81 · good" hint="ok" tone="good" />,
    )
    expect(container.firstChild).toHaveClass('gt-ops-metric', 'gt-ops-metric--good')

    rerender(<MetricTile label="Library health" value="64 · fair" tone="fair" />)
    expect(container.firstChild).toHaveClass('gt-ops-metric--fair')

    rerender(<MetricTile label="Library health" value="31 · poor" tone="poor" />)
    expect(container.firstChild).toHaveClass('gt-ops-metric--poor')

    rerender(<MetricTile label="Library health" value="n/a" tone="na" />)
    expect(container.firstChild).toHaveClass('gt-ops-metric--na')

    rerender(<MetricTile label="CPU" value="12%" />)
    expect(container.firstChild).toHaveClass('gt-ops-metric')
    expect(container.firstChild).not.toHaveClass('gt-ops-metric--good')
    expect(container.firstChild).not.toHaveClass('gt-ops-metric--na')

    rerender(<MetricTile label="X" value="1" tone="weird" />)
    expect(container.firstChild.className).toBe('gt-ops-metric')
  })
})

describe('formatLibraryWatchStatus / detail', () => {
  test('honest off when disabled', () => {
    const watch = {
      enabled: false,
      running: false,
      roots: 0,
      pending_libraries: 0,
      debounce_seconds: 3,
      note: 'Set GT_LIBRARY_WATCH=1 to enable root-folder incremental watch.',
    }
    expect(formatLibraryWatchStatus(watch)).toBe('off')
    expect(formatLibraryWatchDetail(watch)).toBe(
      'Set GT_LIBRARY_WATCH=1 to enable root-folder incremental watch.',
    )
  })

  test('running shows roots and pending', () => {
    const watch = {
      enabled: true,
      running: true,
      roots: 2,
      pending_libraries: 1,
      debounce_seconds: 3.5,
      note: null,
    }
    expect(formatLibraryWatchStatus(watch)).toBe('running')
    expect(formatLibraryWatchDetail(watch)).toBe('2 roots · 1 pending · 3.5s debounce')
  })

  test('enabled but not running includes note', () => {
    const watch = {
      enabled: true,
      running: false,
      roots: 0,
      pending_libraries: 0,
      debounce_seconds: 3,
      note: 'Enabled but watcher not started (boot pending or start failed).',
    }
    expect(formatLibraryWatchStatus(watch)).toBe('enabled (not running)')
    expect(formatLibraryWatchDetail(watch)).toContain('Enabled but watcher not started')
    expect(formatLibraryWatchDetail(watch)).toContain('0 roots · 0 pending · 3s debounce')
  })

  test('missing pulse is n/a', () => {
    expect(formatLibraryWatchStatus(null)).toBe('n/a')
    expect(formatLibraryWatchDetail(undefined)).toBe('n/a')
  })
})

describe('issueFold', () => {
  test('prefers category over severity', () => {
    expect(issueFold({ category: 'action', severity: 'warn' })).toBe('action')
    expect(issueFold({ category: 'warning', severity: 'bad' })).toBe('soft')
    expect(issueFold({ category: 'info', severity: 'bad' })).toBe('soft')
  })

  test('falls back to severity when category absent', () => {
    expect(issueFold({ severity: 'bad' })).toBe('action')
    expect(issueFold({ severity: 'warn' })).toBe('soft')
    expect(issueFold({ severity: 'info' })).toBe('soft')
  })

  test('disk_* with category info stays soft (Backend remap)', () => {
    expect(
      issueFold({
        id: 'disk_games_warn',
        severity: 'info',
        category: 'info',
        message: 'Games disk 72% used',
      }),
    ).toBe('soft')
  })
})

describe('partitionIssues + banner', () => {
  test('splits action and soft; banner follows folds', () => {
    const { action, soft } = partitionIssues([
      { id: 'readyz', category: 'action', severity: 'bad', message: 'down' },
      { id: 'disk_games_critical', category: 'warning', severity: 'warn', message: 'full' },
      { id: 'note', category: 'info', severity: 'info', message: 'hint' },
    ])
    expect(action.map((i) => i.id)).toEqual(['readyz'])
    expect(soft.map((i) => i.id)).toEqual(['disk_games_critical', 'note'])
    expect(resolveBannerSeverity([...action, ...soft], 'good')).toBe('bad')
    expect(resolveBannerSeverity(soft, 'good')).toBe('warn')
    expect(resolveBannerSeverity([], 'good')).toBe('good')
  })

  test('severityLabel wording', () => {
    expect(severityLabel('bad')).toBe('Needs attention')
    expect(severityLabel('warn')).toBe('Degraded')
    expect(severityLabel('good')).toBe('All systems healthy')
  })

  // GT-C1 (UID-013): the banner headline must never repeat a fold title, or the
  // Dashboard shows the same words twice in a row.
  test('banner headline never collides with a fold title', () => {
    const foldTitles = ['Action required', 'Warning / Info']
    for (const severity of ['bad', 'warn', 'good']) {
      expect(foldTitles).not.toContain(severityLabel(severity))
    }
  })
})

// GT-C2 (UID-014): shared metric chrome for pages other than Dashboard/Ops.
describe('MetricStrip', () => {
  test('renders tiles with tone classes', () => {
    const { container } = render(
      <MetricStrip
        label="Roster"
        items={[
          { id: 'a', label: 'Accounts', value: 4, hint: 'in household', tone: 'info' },
          { id: 'b', label: 'Inactive', value: 2, tone: 'warning' },
        ]}
      />,
    )
    expect(screen.getByLabelText('Roster')).toBeInTheDocument()
    expect(screen.getByText('Accounts')).toBeInTheDocument()
    expect(container.querySelector('.gt-ops-metric--info')).toBeTruthy()
    expect(container.querySelector('.gt-ops-metric--warning')).toBeTruthy()
  })

  test('skips entries with no value so pages need no branching', () => {
    render(
      <MetricStrip
        items={[
          { id: 'a', label: 'Present', value: 0 },
          { id: 'b', label: 'Absent', value: undefined },
        ]}
      />,
    )
    expect(screen.getByText('Present')).toBeInTheDocument()
    expect(screen.queryByText('Absent')).not.toBeInTheDocument()
  })

  test('renders nothing rather than an empty strip', () => {
    const { container } = render(<MetricStrip items={[]} />)
    expect(container.querySelector('.gt-ops-strip')).toBeNull()
  })
})

describe('metric tone helpers (UX-C12)', () => {
  test('usageTone escalates as a "higher is worse" metric climbs', () => {
    expect(usageTone(10)).toBe('good')
    expect(usageTone(90)).toBe('fair')
    expect(usageTone(99)).toBe('poor')
  })

  test('usageTone takes custom thresholds for non-percentage metrics', () => {
    // DB ping in ms: 40ms is fine, 300ms is not.
    expect(usageTone(40, { warn: 50, bad: 250 })).toBe('good')
    expect(usageTone(300, { warn: 50, bad: 250 })).toBe('poor')
  })

  test('healthTone escalates as a "higher is better" metric falls', () => {
    expect(healthTone(90)).toBe('good')
    expect(healthTone(40)).toBe('fair')
    expect(healthTone(5)).toBe('poor')
  })

  test('unknown values are na, never a reassuring green', () => {
    expect(usageTone(null)).toBe('na')
    expect(usageTone(undefined)).toBe('na')
    expect(usageTone('nonsense')).toBe('na')
    expect(healthTone(null)).toBe('na')
    expect(booleanTone(null)).toBe('na')
  })

  test('booleanTone maps a plain up/down signal', () => {
    expect(booleanTone(true)).toBe('good')
    expect(booleanTone(false)).toBe('poor')
  })
})
