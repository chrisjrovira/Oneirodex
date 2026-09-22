"""INSP-34 (v11 H1b): TOSEC and MAME as reference-set sources.

TOSEC names carry ``(1991)(Publisher)(EU)[cr Group]`` groups the shared peel
already strips; MAME ``machine`` / softlist ``software`` nodes hold the human
title in ``<description>`` while ``name=`` is the short set id. Neither needs
a new platform enum -- ``ARCADE`` and the home computers already exist.
"""
from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select

from oneirodex.models import ReferenceSet, ReferenceSetEntry
from oneirodex.utils.set_completion import (
    VALID_SOURCES,
    lookup_unique_dat_hash_hit,
    normalize_source,
    parse_dat_bytes,
    upsert_reference_set,
)

TOSEC_DAT = """<?xml version="1.0"?>
<datafile>
  <header><name>Commodore Amiga - Games - [ADF] (TOSEC-v2024-01-01)</name></header>
  <game name="Lemmings (1991)(Psygnosis)(EU)[cr Skid Row]">
    <description>Lemmings (1991)(Psygnosis)(EU)[cr Skid Row]</description>
    <rom name="Lemmings (1991)(Psygnosis)(EU)[cr Skid Row].adf" size="901120" crc="1a2b3c4d"
         md5="33333333333333333333333333333333" sha1="cccccccccccccccccccccccccccccccccccccccc"/>
  </game>
  <game name="Lemmings (1991)(Psygnosis)(EU)(Disk 1 of 2)[a]">
    <description>Lemmings (1991)(Psygnosis)(EU)(Disk 1 of 2)[a]</description>
    <rom name="Lemmings (1991)(Psygnosis)(EU)(Disk 1 of 2)[a].adf" size="901120" crc="1a2b3c4e"/>
  </game>
  <game name="Turrican II - The Final Fight (1991)(Rainbow Arts)[cr PDX]">
    <description>Turrican II - The Final Fight (1991)(Rainbow Arts)[cr PDX]</description>
    <rom name="Turrican II (1991)(Rainbow Arts)[cr PDX].adf" size="901120" crc="5e6f7a8b"
         md5="44444444444444444444444444444444" sha1="dddddddddddddddddddddddddddddddddddddddd"/>
  </game>
</datafile>
"""

MAME_DAT = """<?xml version="1.0"?>
<datafile>
  <header><name>MAME 0.270 (arcade)</name></header>
  <machine name="pacman">
    <description>Pac-Man (Midway)</description>
    <rom name="pacman.6e" size="4096" crc="c1e6ab10" sha1="e87e059c5be45753f7e9f33dff851f16d6751181"/>
  </machine>
  <machine name="puckman">
    <description>Puck Man (Japan set 1)</description>
    <rom name="pm1_prg1.6e" size="2048" crc="f36e88ab" sha1="813cecf44bf5464b1aed64b36f5047e4c79ba176"/>
  </machine>
  <machine name="mspacman">
    <description>Ms. Pac-Man</description>
    <rom name="pacman.6e" size="4096" crc="c1e6ab10" sha1="e87e059c5be45753f7e9f33dff851f16d6751181"/>
  </machine>
</datafile>
"""

SOFTLIST = """<?xml version="1.0"?>
<softwarelist name="gameboy" description="Nintendo Game Boy cartridges">
  <software name="tetris">
    <description>Tetris (World)</description>
    <part name="cart" interface="gameboy_cart">
      <dataarea name="rom" size="32768">
        <rom name="tetris.bin" size="32768" crc="46df91ad" sha1="0a7c6a8f6c7d2b5ea6d3f6b9e1c0a2d3e4f5a6b7"/>
      </dataarea>
    </part>
  </software>
</softwarelist>
"""


def test_new_sources_are_valid_and_normalised():
    assert {'tosec', 'mame'} <= VALID_SOURCES
    assert normalize_source('TOSEC') == 'tosec'
    assert normalize_source(' mame ') == 'mame'
    assert normalize_source('goodtools') == 'other'


def test_tosec_names_peel_to_the_title():
    header, entries = parse_dat_bytes(TOSEC_DAT.encode(), source='tosec')
    assert header.startswith('Commodore Amiga')
    # Two Lemmings dumps collapse onto one title; Turrican keeps its subtitle.
    assert [e['normalized_name'] for e in entries] == ['lemmings', 'turrican ii - the final fight']
    assert entries[0]['crc'] == '1a2b3c4d'
    assert entries[0]['name'].startswith('Lemmings (1991)')


def test_mame_machines_are_titled_by_description():
    header, entries = parse_dat_bytes(MAME_DAT.encode(), source='mame')
    assert header == 'MAME 0.270 (arcade)'
    names = {e['name'] for e in entries}
    assert names == {'Pac-Man (Midway)', 'Puck Man (Japan set 1)', 'Ms. Pac-Man'}
    assert {e['normalized_name'] for e in entries} == {'pac-man', 'puck man', 'ms. pac-man'}


def test_other_sources_still_use_the_name_attribute():
    _header, entries = parse_dat_bytes(MAME_DAT.encode(), source='nointro')
    assert {e['name'] for e in entries} == {'pacman', 'puckman', 'mspacman'}


def test_softlist_software_nodes_parse():
    _header, entries = parse_dat_bytes(SOFTLIST.encode(), source='mame')
    assert [e['name'] for e in entries] == ['Tetris (World)']
    assert entries[0]['crc'] == '46df91ad'


def test_upsert_and_hash_lookup_for_an_arcade_set(db_session):
    ref = upsert_reference_set(
        library_platform='ARCADE',
        region='WORLD',
        source='mame',
        dat_bytes=MAME_DAT.encode(),
        name=f'MAME test {uuid4().hex[:6]}',
    )
    assert ref.source == 'mame'
    rows = db_session.execute(
        select(ReferenceSetEntry).filter_by(set_id=ref.id).order_by(ReferenceSetEntry.name)
    ).scalars().all()
    assert [r.name for r in rows] == ['Ms. Pac-Man', 'Pac-Man (Midway)', 'Puck Man (Japan set 1)']

    # The shared pacman.6e CRC belongs to two machines -> ambiguous, no hit.
    assert lookup_unique_dat_hash_hit(library_platform='ARCADE', crc='c1e6ab10') is None
    hit = lookup_unique_dat_hash_hit(library_platform='ARCADE', crc='f36e88ab')
    assert hit is not None
    assert hit['name'] == 'Puck Man (Japan set 1)'
    assert hit['source'] == 'mame'

    stored = db_session.execute(select(ReferenceSet).filter_by(id=ref.id)).scalars().first()
    assert stored is not None and stored.entry_count == 3
