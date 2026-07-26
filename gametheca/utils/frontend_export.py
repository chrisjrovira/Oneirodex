"""ES-DE gamelist.xml + Pegasus metadata.pegasus.txt export builders."""

from __future__ import annotations

import re
from typing import Any, Iterable
from xml.etree.ElementTree import Element, SubElement, tostring


def _safe_text(value: Any) -> str:
    return str(value or '').strip()


def _pegasus_escape(value: str) -> str:
    return value.replace('\n', ' ').replace('\r', '')


def build_es_de_gamelist(games: Iterable[dict[str, Any]], *, system: str = '') -> bytes:
    """Build EmulationStation / ES-DE gamelist.xml bytes."""
    root = Element('gameList')
    if system:
        SubElement(root, 'provider').text = f'GameTheca/{system}'
    for row in games:
        game_el = SubElement(root, 'game')
        path = _safe_text(row.get('path') or row.get('rom_path') or row.get('full_disk_path'))
        name = _safe_text(row.get('name') or row.get('title') or 'Unknown')
        SubElement(game_el, 'path').text = path or f'./{name}'
        SubElement(game_el, 'name').text = name
        if row.get('summary') or row.get('desc'):
            SubElement(game_el, 'desc').text = _safe_text(row.get('summary') or row.get('desc'))
        if row.get('cover_url') or row.get('image'):
            SubElement(game_el, 'image').text = _safe_text(row.get('cover_url') or row.get('image'))
        if row.get('releasedate') or row.get('first_release_date'):
            SubElement(game_el, 'releasedate').text = _safe_text(
                row.get('releasedate') or row.get('first_release_date'),
            )
        if row.get('developer'):
            SubElement(game_el, 'developer').text = _safe_text(row.get('developer'))
        if row.get('publisher'):
            SubElement(game_el, 'publisher').text = _safe_text(row.get('publisher'))
        if row.get('genre'):
            SubElement(game_el, 'genre').text = _safe_text(row.get('genre'))
        if row.get('uuid'):
            SubElement(game_el, 'id').text = _safe_text(row.get('uuid'))
    xml = tostring(root, encoding='utf-8', xml_declaration=True)
    # ES-DE prefers readable entities for & already handled by ElementTree
    return xml


def build_pegasus_metadata(
    games: Iterable[dict[str, Any]],
    *,
    collection: str,
    shortname: str | None = None,
) -> str:
    """Build Pegasus Frontend metadata.pegasus.txt contents."""
    short = shortname or re.sub(r'[^a-z0-9]+', '', collection.lower()) or 'games'
    lines = [
        f'collection: {_pegasus_escape(collection)}',
        f'shortname: {short}',
        'extension: zip,7z,iso,chd,cue,bin,nes,sfc,smc,n64,z64,gba,gb,gbc,nds,pce,md,sms,gg',
        '',
    ]
    for row in games:
        name = _safe_text(row.get('name') or row.get('title') or 'Unknown')
        path = _safe_text(row.get('path') or row.get('rom_path') or row.get('full_disk_path') or name)
        lines.append(f'game: {_pegasus_escape(name)}')
        lines.append(f'file: {_pegasus_escape(path)}')
        if row.get('summary') or row.get('desc'):
            lines.append(f'description: {_pegasus_escape(_safe_text(row.get("summary") or row.get("desc")))}')
        if row.get('developer'):
            lines.append(f'developer: {_pegasus_escape(_safe_text(row.get("developer")))}')
        if row.get('publisher'):
            lines.append(f'publisher: {_pegasus_escape(_safe_text(row.get("publisher")))}')
        if row.get('genre'):
            lines.append(f'genre: {_pegasus_escape(_safe_text(row.get("genre")))}')
        if row.get('cover_url') or row.get('assets.boxFront'):
            art = _safe_text(row.get('cover_url') or row.get('assets.boxFront'))
            lines.append(f'assets.boxFront: {_pegasus_escape(art)}')
        lines.append('')
    return '\n'.join(lines)


def preview_export_counts(games: list[dict[str, Any]]) -> dict[str, int]:
    return {'games': len(games)}
