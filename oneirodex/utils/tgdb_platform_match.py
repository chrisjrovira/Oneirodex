"""TheGamesDB platform matching for Stage E: platform token aliases, the
family allow / reject tables, hit filtering and the candidate row shape.

Split out of ``software_identify`` in the v11 cycle (H-D.4) as a pure move.
"""
from __future__ import annotations

import re
from oneirodex.utils.software_identify_store import scrub_stage_d_payload




def _norm_platform_token(value: str | None) -> str:
    return re.sub(r'[^a-z0-9]', '', (value or '').casefold())


# Extra TGDB name needles keyed by LibraryPlatform enum name (beyond .value).
_TGDB_PLATFORM_ALIASES: dict[str, tuple[str, ...]] = {
    'GB': ('nintendo game boy', 'game boy'),
    'GBC': ('nintendo game boy color', 'game boy color', 'gbc'),
    'GBA': ('nintendo game boy advance', 'game boy advance', 'gba'),
    'NES': ('nintendo entertainment system', 'nes', 'famicom'),
    'SNES': ('super nintendo', 'snes', 'super famicom'),
    'N64': ('nintendo 64', 'n64'),
    'NDS': ('nintendo ds', 'nds'),
    'N3DS': ('nintendo 3ds', '3ds'),
    'NGC': ('nintendo gamecube', 'gamecube'),
    'WII': ('nintendo wii', 'wii'),
    'WII_U': ('wii u', 'wiiu'),
    'VB': ('nintendo virtual boy', 'virtual boy'),
    'SEGA_MD': ('sega genesis', 'mega drive', 'genesis'),
    'SEGA_MS': ('sega master system', 'master system'),
    'SEGA_GG': ('sega game gear', 'game gear'),
    'SEGA_CD': ('sega cd', 'mega cd'),
    'SEGA_32X': ('sega 32x', '32x'),
    'SEGA_SATURN': ('sega saturn', 'saturn'),
    'SEGA_DC': ('sega dreamcast', 'dreamcast'),
    'SEGA_SG1000': ('sg-1000', 'sg1000'),
    'SEGA_PICO': ('sega pico',),
    'PSX': ('playstation', 'psx', 'ps1'),
    'PS2': ('playstation 2', 'ps2'),
    'PS3': ('playstation 3', 'ps3'),
    'PSP': ('playstation portable', 'psp'),
    'PSVITA': ('ps vita', 'vita'),
    'XBOX': ('xbox',),
    'X360': ('xbox 360',),
    'XONE': ('xbox one', 'xboxone'),
    'PCWIN': ('pc', 'windows', 'microsoft windows'),
    'PCDOS': ('dos', 'ms-dos', 'pc'),
    'PCE': ('pc engine', 'turbografx', 'tg16', 'hu card'),
    'PCE_CD': ('pc engine cd', 'turbografx-cd', 'turbografx cd', 'tgcd'),
    'SUPERGRAFX': ('supergrafx', 'pc engine supergrafx'),
    'NGP': ('neo geo pocket', 'ngp'),
    'NGPC': ('neo geo pocket color', 'ngpc'),
    # BE-DET-8 — AES vs CD stay distinct (substring-safe matching in tgdb_platform_matches).
    'NEOGEO': ('neo geo aes', 'aes'),
    'NEOGEO_CD': ('neo geo cd', 'neocd'),
    'ARCADE': ('arcade',),
    'INTV': ('intellivision',),
    'CHAF': ('channel f', 'fairchild'),
    'O2EM': ('odyssey 2', 'odyssey2', 'videopac'),
    'THREEDO': ('3do',),
    'VECTREX': ('vectrex',),
    'SUPERVISION': ('watara', 'supervision'),
    'GX4000': ('gx4000',),
    'ASTROCADE': ('astrocade',),
    'ARCADIA': ('arcadia 2001',),
    'POKE_MINI': ('pokemon mini', 'pokémon mini'),
    'GAME_WATCH': ('game & watch', 'game watch', 'g&w'),
    'CD_I': ('cd-i', 'philips cd-i'),
    'JAGUAR_CD': ('jaguar cd', 'atari jaguar cd'),
    'AMIGA_CD32': ('amiga cd32', 'cd32'),
    'MSX': ('msx',),
    'ZX_SPECTRUM': ('zx spectrum', 'spectrum'),
    'CPC': ('amstrad cpc',),
    'ATARI_ST': ('atari st',),
    'APPLE_II': ('apple ii', 'apple 2'),
    'ATARI_8BIT': ('atari 8-bit', 'atari 800'),
    'X68000': ('x68000', 'x68k'),
    'PC_98': ('pc-98', 'pc98'),
    'BBC_MICRO': ('bbc micro', 'bbc microcomputer'),
}

# Short library keys: reject tokens that belong to a longer sibling.
# Needle substring otherwise maps Game Boy → Color, Wii → Wii U, etc.
_TGDB_SHORT_REJECT: dict[str, tuple[str, ...]] = {
    'GB': ('color', 'advance', 'gbc', 'gba'),
    'WII': ('wiiu',),
    'JAGUAR': ('jaguarcd', 'cd'),
    'AMIGA': ('cd32',),
    'NGP': ('color', 'ngpc'),
    'PCE': ('cd', 'supergrafx'),
    'PSX': (
        'playstation2', 'playstation3', 'playstation4', 'playstation5',
        'playstationportable', 'psp', 'vita', 'ps2', 'ps3', 'ps4', 'ps5',
    ),
    'XBOX': ('360', 'xboxone', 'series'),
    'NEOGEO': ('pocket',),
}

# Long library keys: token must carry a specificity marker so a short sibling
# name cannot pass via ``needle in token``.
_TGDB_LONG_REQUIRE: dict[str, tuple[str, ...]] = {
    'GBC': ('color', 'gbc'),
    'GBA': ('advance', 'gba'),
    'WII_U': ('wiiu',),
    'JAGUAR_CD': ('cd',),
    'AMIGA_CD32': ('cd32',),
    'NGPC': ('color', 'ngpc'),
    'NGP': ('pocket', 'ngp'),
    'PCE_CD': ('cd',),
    'SUPERGRAFX': ('supergrafx',),
    'PS2': ('playstation2', 'ps2'),
    'PS3': ('playstation3', 'ps3'),
    'PSP': ('portable', 'psp'),
    'PSVITA': ('vita',),
    'X360': ('360',),
    'XONE': ('xboxone',),
}


def _tgdb_family_allows(key: str, token: str) -> bool:
    """False when a sibling platform stole this hit via substring overlap."""
    require = _TGDB_LONG_REQUIRE.get(key)
    if require and not any(marker in token for marker in require):
        return False
    reject = _TGDB_SHORT_REJECT.get(key)
    if reject and any(marker in token for marker in reject):
        return False
    return True


def _library_platform_needles(library_platform: str | None) -> list[str]:
    """Normalized needles for TGDB platform-name matching."""
    key = (library_platform or '').strip()
    if not key:
        return []
    needles: list[str] = []
    try:
        from oneirodex.platform import LibraryPlatform

        plat = LibraryPlatform[key]
        needles.append(_norm_platform_token(plat.value))
        needles.append(_norm_platform_token(plat.name))
    except (KeyError, TypeError):
        needles.append(_norm_platform_token(key))
    for alias in _TGDB_PLATFORM_ALIASES.get(key, ()):
        needles.append(_norm_platform_token(alias))
    # Dedupe preserve order
    seen: set[str] = set()
    out: list[str] = []
    for n in needles:
        if not n or n in seen:
            continue
        seen.add(n)
        out.append(n)
    return out


def _tgdb_token_is_neogeo_cd(token: str) -> bool:
    """True when a normalized TGDB platform token denotes Neo Geo CD (not AES)."""
    if not token:
        return False
    if 'neocd' in token:
        return True
    if 'cd' in token and 'neogeo' in token:
        return True
    return token in ('neogeocd', 'neocd')


def _tgdb_token_is_neogeo_aes(token: str) -> bool:
    """True when a normalized TGDB platform token denotes Neo Geo AES (not CD)."""
    if not token or _tgdb_token_is_neogeo_cd(token):
        return False
    if 'pocket' in token:
        return False
    if 'aes' in token:
        return True
    if token in ('neogeo', 'neogeoaes'):
        return True
    # "Neo Geo" without CD — treat as AES cart family, never CD.
    return 'neogeo' in token


def tgdb_platform_matches(
    hit_platforms: list | None,
    library_platform: str | None,
) -> bool:
    """True when any TGDB platform name corroborates the library leaf platform.

    BE-DET-8 hard guard: Neo Geo AES (``NEOGEO``) never matches Neo Geo CD
    hits (and reverse) — substring ``neogeo`` ⊂ ``neogeocd`` must not leak.
    Longer siblings (Wii U, Game Boy Color, Jaguar CD, …) stay distinct from
    the short name they contain.
    """
    key = (library_platform or '').strip()
    if not key:
        return False

    names: list[str] = []
    for p in hit_platforms or []:
        if isinstance(p, str):
            names.append(p)
        elif isinstance(p, dict):
            names.append(p.get('platform_name') or p.get('name') or '')
    if not names:
        return False

    # Dedicated AES ↔ CD gate (never cross-map). Pocket is not AES.
    if key in ('NEOGEO', 'NEOGEO_CD'):
        for name in names:
            token = _norm_platform_token(name)
            if not token:
                continue
            if key == 'NEOGEO_CD':
                if _tgdb_token_is_neogeo_cd(token):
                    return True
            elif _tgdb_token_is_neogeo_aes(token):
                return True
        return False

    needles = _library_platform_needles(library_platform)
    if not needles:
        return False
    for name in names:
        token = _norm_platform_token(name)
        if not token or not _tgdb_family_allows(key, token):
            continue
        for needle in needles:
            if needle == token or needle in token or token in needle:
                return True
    return False


def filter_tgdb_hits_for_platform(
    hits: list[dict] | None,
    library_platform: str | None,
) -> list[dict]:
    """Keep TGDB hits whose platform list matches the library console leaf."""
    out: list[dict] = []
    for hit in hits or []:
        if not isinstance(hit, dict):
            continue
        if tgdb_platform_matches(hit.get('platforms'), library_platform):
            out.append(hit)
    return out


def _stage_e_candidate_row(hit: dict, *, match_mode: str) -> dict:
    """Scrubbed propose-only candidate (metadata URLs only)."""
    source = (hit.get('source') or '').strip() or 'unknown'
    return scrub_stage_d_payload({
        'source': source,
        'id': hit.get('id') or hit.get('mobygames_id') or hit.get('thegamesdb_id'),
        'name': hit.get('name'),
        'url': hit.get('url'),
        'cover_url': hit.get('cover_url'),
        'summary': hit.get('summary'),
        'mobygames_id': hit.get('mobygames_id'),
        'thegamesdb_id': hit.get('thegamesdb_id'),
        'platforms': hit.get('platforms'),
        'identify_path': 'stage_e',
        'match_mode': match_mode,
        'propose_only': True,
    })
