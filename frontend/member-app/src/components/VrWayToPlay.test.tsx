import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { VrWayToPlayLine, vrCompatCopy } from './VrWayToPlay'
import { collectBadgeSignals } from '../utils/badgeSignals'

test('the details line names each way to play and deep-links the hub', () => {
  const { container, rerender } = render(
    <MemoryRouter>
      <VrWayToPlayLine vrCompat="injector_profile" />
    </MemoryRouter>,
  )
  expect(screen.getByText('VR via community profile')).toBeInTheDocument()
  expect(container.querySelector('[data-vr-compat="injector_profile"]')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'More like this' })).toHaveAttribute(
    'href',
    '/vr?vr_compat=injector_profile',
  )
  // Flat has no hub row to link to; unknown renders nothing at all.
  rerender(
    <MemoryRouter>
      <VrWayToPlayLine vrCompat="flat" />
    </MemoryRouter>,
  )
  expect(screen.getByText('Plays flat')).toBeInTheDocument()
  expect(screen.queryByRole('link')).toBeNull()
  rerender(
    <MemoryRouter>
      <VrWayToPlayLine vrCompat={null} />
    </MemoryRouter>,
  )
  expect(container.querySelector('.od-vr-way')).toBeNull()
})

test('copy never offers to ship or install an injector', () => {
  const copy = vrCompatCopy('injector_profile')!
  expect(copy.body).toMatch(/never ships, installs or points at a shim/)
})

test('the VR badge follows vr_compat and says when it is a community profile', () => {
  const kinds = (game: any) => collectBadgeSignals(game).filter((b: any) => b.kind === 'VR')
  expect(kinds({ is_vr: false, vr_compat: 'injector_profile' })).toHaveLength(1)
  expect(kinds({ is_vr: false, vr_compat: 'injector_profile' })[0].title).toMatch(
    /community injector profile/,
  )
  expect(kinds({ is_vr: true, vr_compat: 'native_vr' })[0].title).toBe('Virtual Reality')
  expect(kinds({ is_vr: false, vr_compat: 'flat' })).toHaveLength(0)
  expect(kinds({ is_vr: false })).toHaveLength(0)
})

test('a headset record adds the runtime and the profile page as a link — nothing more (INSP-40)', () => {
  render(
    <MemoryRouter>
      <VrWayToPlayLine
        vrCompat="injector_profile"
        profiles={[
          {
            kind: 'injector',
            runtime: 'openvr',
            profile_url: 'https://example.invalid/profiles/title',
            notes: 'Works with the community layer.',
            source: 'community',
          },
        ]}
      />
    </MemoryRouter>,
  )
  expect(screen.getByText('OpenVR / SteamVR.')).toBeInTheDocument()
  const link = screen.getByRole('link', { name: 'Community profile page' })
  expect(link).toHaveAttribute('href', 'https://example.invalid/profiles/title')
  expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  expect(screen.getByText('Works with the community layer.')).toBeInTheDocument()
  // A record for another kind does not leak onto this line
  expect(screen.getByRole('link', { name: 'More like this' })).toBeInTheDocument()
})
