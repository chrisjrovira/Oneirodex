"""Helpers for admin multi-select library scan / edit / delete (W22-1)."""

from __future__ import annotations

LIBRARY_BATCH_UUID_CAP = 100
LIBRARY_BATCH_DELETE_CAP = 50


def parse_bool_flag(raw, default=False) -> bool:
    if raw is None:
        return default
    if isinstance(raw, bool):
        return raw
    return str(raw).strip().lower() in ('1', 'true', 'yes', 'on')


def parse_library_uuids(data: dict) -> tuple[list[str] | None, dict | None]:
    """Accept ``library_uuids`` list or singular ``library_uuid``.

    Returns ``(uuids, error_response_tuple_or_None)`` where error is
    ``(jsonify_payload, http_status)`` dict+int for the caller to return.
    """
    raw = data.get('library_uuids')
    if raw is None and data.get('uuids') is not None:
        raw = data.get('uuids')
    if raw is None and data.get('library_uuid'):
        raw = [data.get('library_uuid')]
    if raw is None:
        return None, ({
            'ok': False,
            'error': 'library_uuids required (list) or library_uuid',
            'status': 'rejected',
        }, 400)
    if isinstance(raw, str):
        raw = [raw]
    if not isinstance(raw, list):
        return None, ({
            'ok': False,
            'error': 'library_uuids must be a list',
            'status': 'rejected',
        }, 400)
    uuids: list[str] = []
    seen = set()
    for item in raw:
        text = str(item or '').strip()
        if not text or text in seen:
            continue
        seen.add(text)
        uuids.append(text)
    if not uuids:
        return None, ({
            'ok': False,
            'error': 'library_uuids must contain at least one uuid',
            'status': 'rejected',
        }, 400)
    return uuids, None


def parse_confirm_names(data: dict) -> dict[str, str]:
    """Map library uuid → expected typed name.

    Accepts:
      - confirm_names: {uuid: name} or [{uuid|library_uuid, name|confirm_name}]
      - confirm_name: single string (applied to every uuid by caller)
    """
    out: dict[str, str] = {}
    raw = data.get('confirm_names')
    if isinstance(raw, dict):
        for key, value in raw.items():
            uuid = str(key or '').strip()
            name = str(value or '').strip()
            if uuid and name:
                out[uuid] = name
        return out
    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict):
                continue
            uuid = str(
                item.get('uuid') or item.get('library_uuid') or ''
            ).strip()
            name = str(
                item.get('name') or item.get('confirm_name') or ''
            ).strip()
            if uuid and name:
                out[uuid] = name
    return out


def names_match(expected: str, provided: str | None) -> bool:
    return str(provided or '').strip() == str(expected or '').strip()


def require_confirm_or_force(
    *,
    library_uuid: str,
    library_name: str,
    force: bool,
    confirm_names: dict[str, str],
    single_confirm_name: str | None,
) -> str | None:
    """Return error code string when confirmation fails; None when OK.

    ``force=true`` skips typed-name confirmation (auth/CSRF still required
    at the route layer). Without force, ``confirm_names[uuid]`` or
    ``confirm_name`` must exactly match the library name.
    """
    if force:
        return None
    provided = confirm_names.get(library_uuid)
    if provided is None and single_confirm_name is not None:
        provided = single_confirm_name
    if provided is None or not str(provided).strip():
        return 'confirm_name_required'
    if not names_match(library_name, provided):
        return 'confirm_name_mismatch'
    return None
