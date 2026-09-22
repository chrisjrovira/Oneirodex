"""Named mod profiles and the shareable export code (INSP-37, v11 cycle H2d).

A *profile* is a named set of tracked-mod ids on one game's pack. Activating
it is the one-click enable set: rows in the profile turn on, every other row
turns off, and the companion's next *Apply mods* stages exactly that set in
load order (it already reads ``enabled`` + ``load_order``; nothing new to
teach it).

The *export code* is ``od-mod:`` + base64url of a small JSON document -- the
profile name and, for each mod, the fields another household needs to
recreate the row (name, version, loader, ``source_url``). Import validates
the code against the receiving pack: a mod already tracked there (by id, or
by ``source_url``) joins the profile; one that is not is **reported as
missing**, never invented -- a librarian adds it by hand or from the
catalogue, then imports again. No file moves in either direction.
"""

from __future__ import annotations

import base64
import binascii
import json
import re
from typing import Any

from oneirodex.utils.game_mods import load_mods, save_mods

EXPORT_PREFIX = 'od-mod:'
EXPORT_VERSION = 1
MAX_CODE_BYTES = 64 * 1024
_SLUG = re.compile(r'[^a-z0-9]+')


def _profile_id(name: str, taken: set[str]) -> str:
    base = _SLUG.sub('-', (name or '').lower()).strip('-')[:40] or 'profile'
    candidate = base
    n = 2
    while candidate in taken:
        candidate = f'{base}-{n}'
        n += 1
    return candidate


def list_profiles(game_uuid: str) -> dict[str, Any]:
    pack = load_mods(game_uuid)
    return {'profiles': pack['profiles'], 'active_profile': pack['active_profile']}


def create_profile(game_uuid: str, *, name: str, mod_ids: list[str] | None = None) -> dict[str, Any]:
    """A new profile. ``mod_ids`` ``None`` means "the rows enabled right now"."""
    pack = load_mods(game_uuid)
    name = (name or '').strip()[:120]
    if not name:
        raise ValueError('Profile name required')
    if len(pack['profiles']) >= 32:
        raise ValueError('Too many profiles for one game (32)')
    known = {row['id'] for row in pack['mods']}
    if mod_ids is None:
        ids = [row['id'] for row in pack['mods'] if row.get('enabled')]
    else:
        ids = [str(m) for m in mod_ids if str(m) in known]
    profile = {'id': _profile_id(name, {p['id'] for p in pack['profiles']}), 'name': name, 'mod_ids': ids}
    saved = save_mods(game_uuid, pack['mods'], profiles=[*pack['profiles'], profile])
    return next(p for p in saved['profiles'] if p['id'] == profile['id'])


def delete_profile(game_uuid: str, profile_id: str) -> bool:
    pack = load_mods(game_uuid)
    rest = [p for p in pack['profiles'] if p['id'] != profile_id]
    if len(rest) == len(pack['profiles']):
        return False
    active = '' if pack['active_profile'] == profile_id else None
    save_mods(game_uuid, pack['mods'], profiles=rest, active_profile=active)
    return True


def activate_profile(game_uuid: str, profile_id: str) -> dict[str, Any]:
    """Enable exactly the profile's rows and remember which profile is on."""
    pack = load_mods(game_uuid)
    profile = next((p for p in pack['profiles'] if p['id'] == profile_id), None)
    if profile is None:
        raise LookupError('Profile not found')
    wanted = set(profile['mod_ids'])
    mods = [{**row, 'enabled': row['id'] in wanted} for row in pack['mods']]
    return save_mods(game_uuid, mods, active_profile=profile_id)


def export_profile(game_uuid: str, profile_id: str) -> str:
    pack = load_mods(game_uuid)
    profile = next((p for p in pack['profiles'] if p['id'] == profile_id), None)
    if profile is None:
        raise LookupError('Profile not found')
    by_id = {row['id']: row for row in pack['mods']}
    doc = {
        'v': EXPORT_VERSION,
        'name': profile['name'],
        'default_loader': pack['default_loader'],
        'mods': [
            {
                'id': mid,
                'name': by_id[mid]['name'],
                'version': by_id[mid]['version'],
                'loader': by_id[mid]['loader'],
                'source_url': by_id[mid]['source_url'],
                'load_order': by_id[mid]['load_order'],
            }
            for mid in profile['mod_ids']
            if mid in by_id
        ],
    }
    raw = json.dumps(doc, separators=(',', ':'), ensure_ascii=True).encode('utf-8')
    return EXPORT_PREFIX + base64.urlsafe_b64encode(raw).decode('ascii').rstrip('=')


def decode_export(code: str) -> dict[str, Any]:
    """The JSON document inside an export code, or ``ValueError``."""
    text = (code or '').strip()
    if not text.startswith(EXPORT_PREFIX):
        raise ValueError('Not an Oneirodex mod profile code (expected od-mod:…)')
    body = text[len(EXPORT_PREFIX):].strip()
    if not body or len(body) > MAX_CODE_BYTES:
        raise ValueError('Profile code is empty or too long')
    try:
        raw = base64.urlsafe_b64decode(body + '=' * (-len(body) % 4))
        doc = json.loads(raw.decode('utf-8'))
    except (binascii.Error, UnicodeDecodeError, ValueError) as exc:
        raise ValueError('Profile code is not readable') from exc
    if not isinstance(doc, dict) or doc.get('v') != EXPORT_VERSION or not isinstance(doc.get('mods'), list):
        raise ValueError('Profile code has an unknown shape or version')
    return doc


def import_profile(game_uuid: str, code: str, *, name: str | None = None) -> dict[str, Any]:
    """Create a profile from a code, matched against *this* pack.

    A mod in the code joins the profile when the pack already tracks it (same
    id, else same ``source_url``). The rest come back as ``missing`` rows --
    everything a librarian needs to add them -- and are **not** created.
    """
    doc = decode_export(code)
    pack = load_mods(game_uuid)
    by_id = {row['id']: row for row in pack['mods']}
    by_url = {row['source_url']: row for row in pack['mods'] if row.get('source_url')}
    matched: list[str] = []
    missing: list[dict[str, Any]] = []
    for entry in doc['mods']:
        if not isinstance(entry, dict):
            continue
        mid = str(entry.get('id') or '').strip()
        url = str(entry.get('source_url') or '').strip()
        row = by_id.get(mid) or (by_url.get(url) if url else None)
        if row is not None:
            if row['id'] not in matched:
                matched.append(row['id'])
        else:
            missing.append({
                'name': str(entry.get('name') or mid or url)[:256],
                'version': str(entry.get('version') or '')[:64],
                'loader': str(entry.get('loader') or '')[:64],
                'source_url': url[:2048],
            })
    profile = create_profile(game_uuid, name=(name or str(doc.get('name') or 'Imported profile')), mod_ids=matched)
    return {
        'profile': profile,
        'matched': len(matched),
        'missing': missing,
        'suggested_default_loader': str(doc.get('default_loader') or ''),
    }

