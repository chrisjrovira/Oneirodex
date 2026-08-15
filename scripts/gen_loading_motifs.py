#!/usr/bin/env python
"""Generate the per-system loading-motif catalogue from LibraryPlatform.

GT-B24. One motif per system GameTheca serves — 117 of them — rather than six
abstract shapes. Generated rather than hand-written for two reasons:

  * `LibraryPlatform` is the only authoritative list of what we support. A
    hand-maintained catalogue drifts the moment a platform is added, and a
    motif id with no platform (or a platform with no motif) is exactly the kind
    of gap that leaves a member's picker showing a blank tile.
  * 117 hand-drawn SVGs would be 117 chances to typo a path. Each platform maps
    to a drawing *archetype* (pad, console, handheld, cabinet, computer, disc)
    plus a small variant, so related systems stay recognisably related and the
    geometry is written once.

Archetypes are deliberately coarse. At 18-28px a Master System and a Mega Drive
cannot be told apart no matter how they are drawn, so the variant carries what
detail survives at that size: button count, screen shape, cartridge slot.

    python scripts/gen_loading_motifs.py            # write catalogue
    python scripts/gen_loading_motifs.py --check    # verify it is current
"""

from __future__ import annotations

import json
import pathlib
import re
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
PLATFORM_PY = REPO / 'gametheca' / 'platform.py'
OUT_JSON = REPO / 'gametheca' / 'data' / 'loading_motifs.json'
# Emitted into the app tree rather than imported across it: frontend/shared had
# to be staged explicitly in the Dockerfile and broke the image build once
# (see dockerStagedImports.test.js). A generated file inside member-app/src is
# picked up by the normal `COPY frontend/member-app/` with no special casing.
OUT_JS = REPO / 'frontend' / 'member-app' / 'src' / 'components' / 'systemMotifCatalogue.js'

# Family → the vendor grouping a member actually thinks in. Drives the grouped
# picker; a flat 117-row list is unusable.
FAMILY_RULES: list[tuple[str, str, str]] = [
    # (regex over the enum name, family, archetype)
    (r'^(PCWIN|PCDOS|MAC|LINUX)$', 'Computer', 'computer'),
    (r'^(AMIGA|VICE_|ATARI_ST|MSX|ZX|C16|CPC|GX4000)', 'Home computer', 'computer'),
    (r'^(NES|SNES|N64|NGC|WII|WIIU|SWITCH|FDS|SUFAMI)', 'Nintendo', 'pad'),
    (r'^(GB|GBA|GBC|NDS|N3DS|VB|POKEMINI)', 'Nintendo handheld', 'handheld'),
    (r'^(PSX|PS2|PS3|PS4|PS5)$', 'PlayStation', 'pad'),
    (r'^(PSP|PSVITA)$', 'PlayStation handheld', 'handheld'),
    (r'^(XBOX|X360|XONE|XSX)$', 'Xbox', 'pad'),
    (r'^SEGA_(GG)$', 'Sega handheld', 'handheld'),
    (r'^(SEGA_|GENESIS|DREAMCAST|SATURN)', 'Sega', 'console'),
    (r'^(LYNX|NGP|NGPC|WS|WSC|SUPERVISION|GAMATE|GAMEKING)', 'Handheld', 'handheld'),
    (r'^(ATARI_|JAGUAR|A5200|A7800|A2600)', 'Atari', 'console'),
    (r'^(PCE|PCFX|SUPERGRAFX|TG16)', 'NEC', 'console'),
    (r'^(NEOGEO)', 'SNK', 'console'),
    (r'^(ARCADE|MAME|FBNEO|CPS)', 'Arcade', 'cabinet'),
    (r'^(VECTREX)$', 'Vector', 'cabinet'),
    (r'^(THREEDO|CDI|CDTV|SEGA_CD|PCE_CD|NEOGEO_CD)', 'Disc era', 'disc'),
    (r'^(INTV|COLECO|CHAF|O2EM|ASTROCADE|ARCADIA|VC4000|ELEKTOR)', 'Early console', 'console'),
]

DEFAULT_FAMILY = 'Other systems'
DEFAULT_ARCHETYPE = 'cart'

# Variant index within an archetype gives related systems distinguishable
# geometry (button counts, screen aspect) without inventing 117 drawings.
VARIANTS = 6


def read_platforms() -> list[tuple[str, str]]:
    """Members of LibraryPlatform only.

    Bounded at the next class declaration: platform.py also defines `Emulator`,
    which reuses names like O2EM with different values. Reading to end-of-file
    pulled those in and produced duplicate motif ids — caught by the guard in
    build(), which is why it is there.
    """
    source = PLATFORM_PY.read_text(encoding='utf-8')
    start = source.index('class LibraryPlatform')
    next_class = re.search(r'^class \w+', source[start + 1:], re.M)
    body = source[start:start + 1 + next_class.start()] if next_class else source[start:]
    return re.findall(r'^\s{4}([A-Z0-9_]+)\s*=\s*"([^"]+)"', body, re.M)


def classify(name: str) -> tuple[str, str]:
    for pattern, family, archetype in FAMILY_RULES:
        if re.match(pattern, name):
            return family, archetype
    return DEFAULT_FAMILY, DEFAULT_ARCHETYPE


def build() -> dict:
    rows = []
    seen_ids: set[str] = set()

    for name, label in read_platforms():
        motif_id = name.lower()
        if motif_id in seen_ids:
            raise SystemExit(f'duplicate motif id from enum name: {name}')
        seen_ids.add(motif_id)

        family, archetype = classify(name)
        rows.append({
            'id': motif_id,
            'name': label,
            'family': family,
            'archetype': archetype,
            # Stable per id, so a system's glyph never changes between builds.
            'variant': sum(ord(c) for c in motif_id) % VARIANTS,
        })

    families: dict[str, int] = {}
    for row in rows:
        families[row['family']] = families.get(row['family'], 0) + 1

    return {
        'generated_from': 'gametheca/platform.py',
        'count': len(rows),
        'families': dict(sorted(families.items())),
        'motifs': rows,
    }


def js_module(payload: dict) -> str:
    """Frontend twin of the JSON catalogue."""
    rows = ",\n".join(
        "  { id: '%s', name: %s, family: '%s', archetype: '%s', variant: %d }"
        % (r["id"], json.dumps(r["name"]), r["family"], r["archetype"], r["variant"])
        for r in payload["motifs"]
    )
    header = [
        "// GENERATED by scripts/gen_loading_motifs.py - do not edit.",
        "//",
        "// One motif per system in LibraryPlatform (GT-B24). Generated so a new",
        "// platform cannot end up without a glyph, and so the picker, the backend",
        "// catalogue and the renderer cannot disagree about what exists.",
        "",
        "export const SYSTEM_MOTIFS = [",
    ]
    footer = [
        "]",
        "",
        "/** Grouped by family - a flat %d-row list is not a usable picker. */"
        % payload["count"],
        "export const SYSTEM_MOTIF_FAMILIES = SYSTEM_MOTIFS.reduce((acc, motif) => {",
        "  ;(acc[motif.family] ||= []).push(motif)",
        "  return acc",
        "}, {})",
        "",
        "export const SYSTEM_MOTIF_IDS = SYSTEM_MOTIFS.map((m) => m.id)",
        "",
    ]
    return "\n".join(header) + "\n" + rows + ",\n" + "\n".join(footer)


def main() -> int:
    payload = build()
    text = json.dumps(payload, indent=2) + '\n'

    if '--check' in sys.argv:
        current = OUT_JSON.read_text(encoding='utf-8') if OUT_JSON.exists() else ''
        current_js = OUT_JS.read_text(encoding='utf-8') if OUT_JS.exists() else ''
        if current != text or current_js != js_module(payload):
            print('loading_motifs.json is stale — run scripts/gen_loading_motifs.py')
            return 1
        print(f'loading_motifs.json current ({payload["count"]} systems)')
        return 0

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(text, encoding='utf-8')
    OUT_JS.write_text(js_module(payload), encoding='utf-8')
    print(f'wrote {OUT_JSON.relative_to(REPO)} — {payload["count"]} systems, '
          f'{len(payload["families"])} families')
    for family, count in payload['families'].items():
        print(f'  {family}: {count}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
