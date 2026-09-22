import { Link } from 'react-router-dom'

/**
 * How a title plays in VR, from the `vr_compat` the server derives or a
 * librarian stored (rider R3, v11 H-T P4). One line on the details page and
 * the row copy on Ways to play. Catalogue and deep link only: an injector
 * profile is *named* here, never shipped, installed or pointed at as a file.
 */
export type VrCompat = 'native_vr' | 'injector_profile' | 'flat' | null | undefined

export const VR_COMPAT_COPY: Record<
  Exclude<VrCompat, null | undefined>,
  { label: string; title: string; body: string; hubQuery: string | null }
> = {
  native_vr: {
    label: 'Plays in VR',
    title: 'Native VR — the title ships a VR mode',
    body: 'Shipped with a VR mode. Launch it on the household PC and put the headset on.',
    hubQuery: 'native_vr',
  },
  injector_profile: {
    label: 'VR via community profile',
    title:
      'A community injector profile exists for this title. Oneirodex links to it and never ships it.',
    body: 'A community injector profile exists. Oneirodex tells you it exists and links to the profile page — it never ships, installs or points at a shim.',
    hubQuery: 'injector_profile',
  },
  flat: {
    label: 'Plays flat',
    title: 'No VR mode — from a headset seat, stream it flat with Moonlight',
    body: 'No VR mode. From a headset seat, stream it flat to the headset browser with Moonlight.',
    hubQuery: null,
  },
}

export function vrCompatCopy(value: VrCompat) {
  return value ? VR_COMPAT_COPY[value] : null
}

export interface VrProfileLike {
  kind: 'native' | 'injector' | 'flat'
  runtime: 'openxr' | 'openvr' | null
  profile_url: string | null
  notes: string
  source: 'librarian' | 'community'
}

const RUNTIME_LABEL: Record<string, string> = { openxr: 'OpenXR', openvr: 'OpenVR / SteamVR' }
const KIND_FOR_COMPAT: Record<string, VrProfileLike['kind']> = {
  native_vr: 'native',
  injector_profile: 'injector',
  flat: 'flat',
}

/** The record that backs a `vr_compat` word, when the game has one (INSP-40). */
export function profileFor(vrCompat: VrCompat, profiles?: VrProfileLike[] | null) {
  if (!vrCompat || !profiles?.length) return null
  const kind = KIND_FOR_COMPAT[vrCompat]
  return profiles.find((p) => p.kind === kind) || null
}

/**
 * The details-page line. Renders nothing when the answer is unknown. With a
 * headset record (INSP-40) it adds the runtime and the profile *page* — a
 * link and nothing more; Oneirodex never ships, installs or points at a shim.
 */
export function VrWayToPlayLine({
  vrCompat,
  profiles,
}: {
  vrCompat: VrCompat
  profiles?: VrProfileLike[] | null
}) {
  const copy = vrCompatCopy(vrCompat)
  if (!copy) return null
  const profile = profileFor(vrCompat, profiles)
  return (
    <p
      className="od-details-page__muted od-vr-way"
      data-vr-compat={vrCompat as string}
      title={copy.title}
    >
      <strong>{copy.label}</strong> — {copy.body}{' '}
      {profile?.runtime ? (
        <span className="od-vr-way__runtime">{RUNTIME_LABEL[profile.runtime]}. </span>
      ) : null}
      {profile?.profile_url ? (
        <a href={profile.profile_url} target="_blank" rel="noreferrer noopener">
          {profile.kind === 'injector' ? 'Community profile page' : 'Details page'}
        </a>
      ) : null}
      {profile?.profile_url && copy.hubQuery ? ' · ' : null}
      {copy.hubQuery ? <Link to={`/vr?vr_compat=${copy.hubQuery}`}>More like this</Link> : null}
      {profile?.notes ? <span className="od-vr-way__notes"> {profile.notes}</span> : null}
    </p>
  )
}
