import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScanMatchSettingsPage } from './ScanMatchSettingsPage'
import {
  PEEL_PROFILES,
  bodyFromForm,
  exposedPolicyKeys,
  formFromPayload,
  hasPolicyKey,
} from './scanMatchSettingsApi'

function jsonOk(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

function jsonErr(status, body = {}) {
  return {
    ok: false,
    status,
    json: async () => body,
  }
}

describe('scanMatchSettingsApi helpers', () => {
  test('hasPolicyKey soft-degrades missing keys and forbids mega-lib', () => {
    expect(hasPolicyKey({ propose_only_scan: false }, 'propose_only_scan')).toBe(true)
    expect(hasPolicyKey({ propose_only_scan: false }, 'peel_profile')).toBe(false)
    expect(hasPolicyKey({ mega_lib: true }, 'mega_lib')).toBe(false)
    expect(hasPolicyKey({ family_walk_depth: 3 }, 'family_walk_depth')).toBe(false)
  })

  test('formFromPayload only copies exposed keys', () => {
    const { form, exposed } = formFromPayload({
      propose_only_scan: true,
      peel_profile: 'aggressive',
      enable_year_drop_variant: true,
      mega_lib: true,
    })
    expect(exposed).toEqual(
      expect.arrayContaining(['propose_only_scan', 'peel_profile', 'enable_year_drop_variant']),
    )
    expect(exposed).not.toContain('mega_lib')
    expect(form.propose_only_scan).toBe(true)
    expect(form.peel_profile).toBe(PEEL_PROFILES.AGGRESSIVE)
    expect(form.enable_year_drop_variant).toBe(true)
    expect(form.dupe_title_threshold).toBeUndefined()
    expect(form.mega_lib).toBeUndefined()
  })

  test('bodyFromForm clamps thresholds and omits unexposed keys', () => {
    const body = bodyFromForm(
      {
        propose_only_scan: true,
        match_high_threshold: 1.5,
        match_ambiguous_gap: -0.2,
        peel_profile: 'AGGRESSIVE',
        dupe_title_threshold: 0.9,
      },
      ['propose_only_scan', 'match_high_threshold', 'match_ambiguous_gap', 'peel_profile'],
    )
    expect(body).toEqual({
      propose_only_scan: true,
      match_high_threshold: 1,
      match_ambiguous_gap: 0,
      peel_profile: PEEL_PROFILES.AGGRESSIVE,
    })
    expect(body.dupe_title_threshold).toBeUndefined()
  })

  test('exposedPolicyKeys lists core + safe variants only', () => {
    const keys = exposedPolicyKeys({
      propose_only_scan: false,
      enable_pack_peel_variant: false,
      depth_3_family_walk: true,
    })
    expect(keys).toEqual(['propose_only_scan', 'enable_pack_peel_variant'])
  })
})

describe('ScanMatchSettingsPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('soft-degrades when API is missing (404)', async () => {
    global.fetch = vi.fn(async () => jsonErr(404, { error: 'not found' }))
    render(<ScanMatchSettingsPage />)
    expect(await screen.findByRole('heading', { name: 'Scan / match policy' })).toBeInTheDocument()
    expect(
      await screen.findByText(/Scan\/match settings API is not available yet/i),
    ).toBeInTheDocument()
    const serverLinks = screen.getAllByRole('link', { name: /Open Server Settings/i })
    expect(serverLinks.length).toBeGreaterThanOrEqual(1)
    expect(serverLinks[0]).toHaveAttribute('href', '/admin/new_server_settings')
    expect(screen.queryByLabelText(/Propose-only scan mode/i)).not.toBeInTheDocument()
  })

  test('renders exposed fields and saves only those keys', async () => {
    const user = userEvent.setup()
    let putBody = null
    global.fetch = vi.fn(async (url, init) => {
      const method = (init?.method || 'GET').toUpperCase()
      if (String(url).includes('/api/admin/scan-match/config') && method === 'GET') {
        return jsonOk({
          propose_only_scan: false,
          dupe_title_threshold: 0.85,
          match_high_threshold: 0.92,
          match_ambiguous_gap: 0.08,
          peel_profile: 'conservative',
          enable_year_drop_variant: true,
        })
      }
      if (String(url).includes('/api/admin/scan-match/config') && method === 'PUT') {
        putBody = JSON.parse(init.body)
        return jsonOk({ ...putBody, message: 'ok' })
      }
      throw new Error(`unexpected ${method} ${url}`)
    })

    render(<ScanMatchSettingsPage />)
    expect(await screen.findByLabelText(/Propose-only scan mode/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Dupe title threshold/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/High-confidence threshold/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Ambiguous gap/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Name peel aggressiveness/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Year-drop search variant/i)).toBeInTheDocument()
    // Honesty copy forbids mega-lib UI; lede/hints must say so — never a control.
    expect(screen.getAllByText(/mega-librar/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByRole('checkbox', { name: /mega/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /family walk/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: /family|depth.?3/i })).not.toBeInTheDocument()

    await user.click(screen.getByLabelText(/Propose-only scan mode/i))
    await user.selectOptions(screen.getByLabelText(/Name peel aggressiveness/i), 'aggressive')
    await user.click(screen.getByRole('button', { name: /Save settings/i }))

    await waitFor(() => {
      expect(putBody).toEqual({
        propose_only_scan: true,
        dupe_title_threshold: 0.85,
        match_high_threshold: 0.92,
        match_ambiguous_gap: 0.08,
        peel_profile: 'aggressive',
        enable_year_drop_variant: true,
      })
    })
    expect(await screen.findByText(/Scan\/match settings saved/i)).toBeInTheDocument()
  })

  test('hides unexposed thresholds when Backend mid-rollout', async () => {
    global.fetch = vi.fn(async () =>
      jsonOk({
        propose_only_scan: true,
        peel_profile: 'conservative',
      }),
    )
    render(<ScanMatchSettingsPage />)
    expect(await screen.findByLabelText(/Propose-only scan mode/i)).toBeChecked()
    expect(screen.getByLabelText(/Name peel aggressiveness/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Dupe title threshold/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/High-confidence threshold/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Ambiguous gap/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Year-drop search variant/i)).not.toBeInTheDocument()
  })
})
