"""ROM set completeness — DAT parse, title normalize, owned/missing match."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

from sqlalchemy import select

from gametheca import db
from gametheca.models import Game, Library, ReferenceSet, ReferenceSetEntry
from gametheca.platform import LibraryPlatform
from gametheca.utils.library_acl import apply_game_access_filters

VALID_REGIONS = frozenset({'USA', 'EUR', 'JPN', 'WORLD', 'OTHER'})
VALID_SOURCES = frozenset({'nointro', 'redump', 'other'})
REGION_PREF_ORDER = ('USA', 'EUR', 'JPN', 'WORLD', 'OTHER')

# Parenthetical / bracket tags commonly found in No-Intro / Redump names.
_REGION_PAREN = re.compile(
    r'\s*\((?:USA|Europe|Japan|World|UE|JU|EU|JP|U|J|E|Asia|Brazil|Korea|'
    r'Australia|France|Germany|Spain|Italy|Netherlands|Sweden|China|'
    r'Hong Kong|Taiwan|Russia|En,Fr,De|En,Ja)[^)]*\)',
    re.IGNORECASE,
)
_REV_PAREN = re.compile(
    r'\s*\((?:Rev\s*[A-Z0-9]+|v?\d+(?:\.\d+)*|Proto|Beta|Sample|Demo|'
    r'Unl|Aftermarket|Pirate|Virtual Console|Switch Online|Wii U Virtual Console|'
    r'GB Compatibility|SGB Enhanced|NTSC|PAL|NTSC-J)[^)]*\)',
    re.IGNORECASE,
)
_DUMP_BRACKETS = re.compile(r'\s*\[[^\]]*\]')
_MULTI_SPACE = re.compile(r'\s+')
_EXT = re.compile(
    r'\.(?:nes|sfc|smc|n64|z64|v64|gb|gbc|gba|nds|gba|md|gen|sms|gg|'
    r'iso|cue|bin|chd|img|rom|zip|7z|rar)$',
    re.IGNORECASE,
)
_CLRMAME_GAME = re.compile(
    r'game\s*\(\s*name\s+"([^"]+)"(.*?)\)\s*(?=game\s*\(|$)',
    re.IGNORECASE | re.DOTALL,
)
_CLRMAME_ROM_CRC = re.compile(r'\bcrc\s+([0-9a-fA-F]+)\b')
_CLRMAME_ROM_MD5 = re.compile(r'\bmd5\s+([0-9a-fA-F]+)\b')
_CLRMAME_ROM_SHA1 = re.compile(r'\bsha1\s+([0-9a-fA-F]+)\b')
_CLRMAME_ROM_SIZE = re.compile(r'\bsize\s+(\d+)\b')
_CLRMAME_HEADER_NAME = re.compile(
    r'(?:clrmamepro|dat)\s*\(\s*.*?name\s+"([^"]+)"',
    re.IGNORECASE | re.DOTALL,
)


def normalize_region(raw: str | None) -> str:
    text = (raw or '').strip().upper()
    aliases = {
        'US': 'USA',
        'U': 'USA',
        'NA': 'USA',
        'EUROPE': 'EUR',
        'EU': 'EUR',
        'E': 'EUR',
        'PAL': 'EUR',
        'JAPAN': 'JPN',
        'JP': 'JPN',
        'J': 'JPN',
        'NTSC-J': 'JPN',
        'W': 'WORLD',
    }
    text = aliases.get(text, text)
    if text in VALID_REGIONS:
        return text
    return 'OTHER'


def normalize_source(raw: str | None) -> str:
    text = (raw or 'nointro').strip().lower()
    return text if text in VALID_SOURCES else 'other'


def normalize_set_title(name: str | None) -> str:
    """Normalize DAT / library title for fuzzy ownership matching."""
    text = (name or '').strip()
    if not text:
        return ''
    text = _EXT.sub('', text)
    text = _DUMP_BRACKETS.sub('', text)
    text = _REGION_PAREN.sub('', text)
    text = _REV_PAREN.sub('', text)
    # Strip any remaining simple parentheticals that look like dump tags.
    text = re.sub(r'\s*\([^)]{1,40}\)', '', text)
    text = _MULTI_SPACE.sub(' ', text).strip().lower()
    return text


def _rom_attrs_from_xml_game(node: ET.Element) -> dict[str, Any]:
    rom = None
    for child in list(node):
        tag = child.tag.rsplit('}', 1)[-1]
        if tag == 'rom':
            rom = child
            break
    if rom is None:
        return {}
    size_raw = rom.attrib.get('size')
    try:
        size = int(size_raw) if size_raw else None
    except ValueError:
        size = None
    return {
        'crc': (rom.attrib.get('crc') or '').lower() or None,
        'md5': (rom.attrib.get('md5') or '').lower() or None,
        'sha1': (rom.attrib.get('sha1') or '').lower() or None,
        'size': size,
        'serial': rom.attrib.get('serial') or None,
    }


def parse_dat_xml(text: str) -> tuple[str, list[dict[str, Any]]]:
    root = ET.fromstring(text)

    def local(tag: str) -> str:
        return tag.rsplit('}', 1)[-1]

    def find_child(parent: ET.Element, name: str) -> ET.Element | None:
        for child in list(parent):
            if local(child.tag) == name:
                return child
        return None

    datafile = root if local(root.tag) == 'datafile' else None
    if datafile is None:
        for node in root.iter():
            if local(node.tag) == 'datafile':
                datafile = node
                break
    if datafile is None:
        datafile = root

    header_name = ''
    header = find_child(datafile, 'header')
    if header is not None:
        name_el = find_child(header, 'name')
        desc_el = find_child(header, 'description')
        if name_el is not None and name_el.text:
            header_name = name_el.text.strip()
        elif desc_el is not None and desc_el.text:
            header_name = desc_el.text.strip()

    entries: list[dict[str, Any]] = []
    seen: set[str] = set()
    for node in list(datafile):
        if local(node.tag) not in ('game', 'machine'):
            continue
        name = (node.attrib.get('name') or '').strip()
        if not name:
            desc = find_child(node, 'description')
            if desc is not None and desc.text:
                name = desc.text.strip()
        if not name:
            continue
        norm = normalize_set_title(name)
        if not norm or norm in seen:
            continue
        seen.add(norm)
        row = {'name': name, 'normalized_name': norm, **_rom_attrs_from_xml_game(node)}
        entries.append(row)
    return header_name, entries


def parse_dat_clrmame(text: str) -> tuple[str, list[dict[str, Any]]]:
    header_m = _CLRMAME_HEADER_NAME.search(text)
    header_name = header_m.group(1).strip() if header_m else ''
    entries: list[dict[str, Any]] = []
    seen: set[str] = set()
    for match in _CLRMAME_GAME.finditer(text):
        name = match.group(1).strip()
        body = match.group(2) or ''
        norm = normalize_set_title(name)
        if not norm or norm in seen:
            continue
        seen.add(norm)
        crc_m = _CLRMAME_ROM_CRC.search(body)
        md5_m = _CLRMAME_ROM_MD5.search(body)
        sha1_m = _CLRMAME_ROM_SHA1.search(body)
        size_m = _CLRMAME_ROM_SIZE.search(body)
        entries.append({
            'name': name,
            'normalized_name': norm,
            'crc': crc_m.group(1).lower() if crc_m else None,
            'md5': md5_m.group(1).lower() if md5_m else None,
            'sha1': sha1_m.group(1).lower() if sha1_m else None,
            'size': int(size_m.group(1)) if size_m else None,
            'serial': None,
        })
    return header_name, entries


def parse_dat_bytes(raw: bytes | str) -> tuple[str, list[dict[str, Any]]]:
    if isinstance(raw, bytes):
        text = raw.decode('utf-8', errors='replace')
    else:
        text = raw
    stripped = text.lstrip()
    if stripped.startswith('<'):
        return parse_dat_xml(text)
    header, entries = parse_dat_clrmame(text)
    if entries:
        return header, entries
    raise ValueError('Unrecognized DAT format (expected XML datafile or ClrMamePro text)')


def validate_library_platform(platform_key: str) -> str:
    key = (platform_key or '').strip().upper()
    try:
        LibraryPlatform[key]
    except KeyError as exc:
        raise ValueError(f'Unknown library_platform: {platform_key}') from exc
    return key


def list_reference_sets() -> list[dict]:
    rows = db.session.execute(
        select(ReferenceSet).order_by(ReferenceSet.library_platform, ReferenceSet.region)
    ).scalars().all()
    return [r.to_dict() for r in rows]


def delete_reference_set(set_id: int) -> bool:
    row = db.session.get(ReferenceSet, set_id)
    if not row:
        return False
    db.session.delete(row)
    db.session.commit()
    return True


def upsert_reference_set(
    *,
    library_platform: str,
    region: str,
    source: str,
    dat_bytes: bytes,
    name: str | None = None,
    uploader_id: int | None = None,
) -> ReferenceSet:
    platform = validate_library_platform(library_platform)
    region_n = normalize_region(region)
    source_n = normalize_source(source)
    header_name, entries = parse_dat_bytes(dat_bytes)
    if not entries:
        raise ValueError('DAT contained no game entries')

    existing = db.session.execute(
        select(ReferenceSet).filter_by(library_platform=platform, region=region_n)
    ).scalars().first()
    if existing:
        db.session.delete(existing)
        db.session.flush()

    ref = ReferenceSet(
        library_platform=platform,
        region=region_n,
        source=source_n,
        name=(name or header_name or f'{platform} {region_n}')[:255],
        entry_count=len(entries),
        uploaded_by_user_id=uploader_id,
    )
    db.session.add(ref)
    db.session.flush()
    for entry in entries:
        db.session.add(
            ReferenceSetEntry(
                set_id=ref.id,
                name=entry['name'][:512],
                normalized_name=entry['normalized_name'][:512],
                crc=entry.get('crc'),
                md5=entry.get('md5'),
                sha1=entry.get('sha1'),
                size=entry.get('size'),
                serial=(entry.get('serial') or None),
            )
        )
    db.session.commit()
    return ref


def _owned_identity(library_platform: str, user) -> dict[str, set[str]]:
    platform = LibraryPlatform[library_platform]
    query = (
        select(Game.name, Game.full_disk_path, Game.file_crc, Game.file_md5, Game.file_sha1)
        .join(Library, Game.library_uuid == Library.uuid)
        .filter(Library.platform == platform)
    )
    query = apply_game_access_filters(query, user)
    titles: set[str] = set()
    crcs: set[str] = set()
    md5s: set[str] = set()
    sha1s: set[str] = set()
    for name, path, crc, md5, sha1 in db.session.execute(query).all():
        norm = normalize_set_title(name)
        if norm:
            titles.add(norm)
        if path:
            bn = normalize_set_title(Path(path).name)
            if bn:
                titles.add(bn)
        if crc:
            crcs.add(crc.lower())
        if md5:
            md5s.add(md5.lower())
        if sha1:
            sha1s.add(sha1.lower())
    return {'titles': titles, 'crc': crcs, 'md5': md5s, 'sha1': sha1s}


def _match_entry(entry: ReferenceSetEntry, owned: dict[str, set[str]]) -> str | None:
    """Return match method name or None."""
    if entry.crc and entry.crc.lower() in owned['crc']:
        return 'crc'
    if entry.md5 and entry.md5.lower() in owned['md5']:
        return 'md5'
    if entry.sha1 and entry.sha1.lower() in owned['sha1']:
        return 'sha1'
    if entry.normalized_name in owned['titles']:
        return 'title'
    return None


def compute_set_completion(
    *,
    library_platform: str,
    region: str,
    user,
    include_matched: bool = True,
    missing_limit: int | None = None,
) -> dict[str, Any] | None:
    platform = validate_library_platform(library_platform)
    region_n = normalize_region(region)
    ref = db.session.execute(
        select(ReferenceSet).filter_by(library_platform=platform, region=region_n)
    ).scalars().first()
    if not ref:
        return None

    entries = list(
        db.session.execute(
            select(ReferenceSetEntry).filter_by(set_id=ref.id)
        ).scalars().all()
    )
    owned = _owned_identity(platform, user)
    matched: list[dict] = []
    missing: list[dict] = []
    method_counts = {'crc': 0, 'md5': 0, 'sha1': 0, 'title': 0}
    for entry in entries:
        method = _match_entry(entry, owned)
        item = {
            'name': entry.name,
            'normalized_name': entry.normalized_name,
            'crc': entry.crc,
        }
        if method:
            item['match_method'] = method
            method_counts[method] = method_counts.get(method, 0) + 1
            matched.append(item)
        else:
            missing.append(item)

    total = len(entries)
    owned_count = len(matched)
    missing_count = len(missing)
    percent = round((owned_count / total) * 100, 1) if total else 0.0
    if missing_limit is not None:
        missing = missing[:missing_limit]
    result = {
        'library_platform': platform,
        'region': region_n,
        'source': ref.source,
        'set_id': ref.id,
        'set_name': ref.name,
        'total': total,
        'owned': owned_count,
        'missing_count': missing_count,
        'percent': percent,
        'missing': missing,
        'match_methods': method_counts,
    }
    if include_matched:
        result['matched'] = matched
    return result


def region_completions_for_platform(library_platform: str, user) -> list[dict[str, Any]]:
    """Per-region set completion summaries for heatmap chips (preferred order first)."""
    platform = validate_library_platform(library_platform)
    rows = db.session.execute(
        select(ReferenceSet).filter_by(library_platform=platform)
    ).scalars().all()
    if not rows:
        return []
    by_region = {r.region: r for r in rows}
    ordered_regions: list[str] = []
    for region in REGION_PREF_ORDER:
        if region in by_region:
            ordered_regions.append(region)
    for region in sorted(by_region.keys()):
        if region not in ordered_regions:
            ordered_regions.append(region)
    out: list[dict[str, Any]] = []
    for region in ordered_regions:
        report = compute_set_completion(
            library_platform=platform,
            region=region,
            user=user,
            include_matched=False,
            missing_limit=0,
        )
        if not report:
            continue
        out.append(
            {
                'region': report['region'],
                'owned': report['owned'],
                'total': report['total'],
                'percent': report['percent'],
                'missing_count': report['missing_count'],
                'set_id': report['set_id'],
            }
        )
    return out


def preferred_completion_for_platform(library_platform: str, user) -> dict[str, Any] | None:
    regions = region_completions_for_platform(library_platform, user)
    if not regions:
        return None
    preferred = dict(regions[0])
    preferred['regions'] = regions
    return preferred



def completion_summaries_by_platform(user) -> dict[str, dict[str, Any]]:
    """Map library_platform → preferred set_completion summary."""
    platforms = {
        r.library_platform
        for r in db.session.execute(select(ReferenceSet.library_platform)).all()
    }
    out: dict[str, dict[str, Any]] = {}
    for platform in platforms:
        try:
            summary = preferred_completion_for_platform(platform, user)
        except ValueError:
            continue
        if summary:
            out[platform] = summary
    return out


def rehash_library_platform(library_platform: str, *, limit: int = 5000) -> dict[str, int]:
    """Compute file hashes for games on a platform that have a disk path."""
    from gametheca.utils.rom_hash import apply_file_hashes_to_game

    platform = validate_library_platform(library_platform)
    enum_plat = LibraryPlatform[platform]
    games = list(
        db.session.execute(
            select(Game)
            .join(Library, Game.library_uuid == Library.uuid)
            .filter(Library.platform == enum_plat)
            .filter(Game.full_disk_path.isnot(None))
            .limit(limit)
        ).scalars().all()
    )
    hashed = 0
    skipped = 0
    for game in games:
        if apply_file_hashes_to_game(game):
            hashed += 1
        else:
            skipped += 1
    db.session.commit()
    return {'platform': platform, 'considered': len(games), 'hashed': hashed, 'skipped': skipped}
