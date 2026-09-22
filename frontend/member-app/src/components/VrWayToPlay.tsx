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

/** The details-page line. Renders nothing when the answer is unknown. */
export function VrWayToPlayLine({ vrCompat }: { vrCompat: VrCompat }) {
  const copy = vrCompatCopy(vrCompat)
  if (!copy) return null
  return (
    <p
      className="od-details-page__muted od-vr-way"
      data-vr-compat={vrCompat as string}
      title={copy.title}
    >
      <strong>{copy.label}</strong> — {copy.body}{' '}
      {copy.hubQuery ? <Link to={`/vr?vr_compat=${copy.hubQuery}`}>More like this</Link> : null}
    </p>
  )
}
