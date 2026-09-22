"""INSP-5 / 1G1R (v11 H1c): parent/clone from the DAT, region preference at
parse time, completion counts each game once, clone-of-owned-parent advisory.
"""
from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select

from oneirodex.models import ReferenceSetEntry
from oneirodex.utils.match_proposal import MATCH_REASON_SUMMARIES
from oneirodex.utils.set_completion import (
    clone_parent_for,
    parse_dat_bytes,
    preferred_entries,
    upsert_reference_set,
)

PARENT_CLONE_DAT = """<?xml version="1.0"?>
<datafile>
  <header><name>MAME clones</name></header>
  <machine name="puckman">
    <description>Puck Man (Japan set 1)</description>
    <rom name="pm1_prg1.6e" size="2048" crc="f36e88ab"/>
  </machine>
  <machine name="pacman" cloneof="puckman">
    <description>Pac-Man (Midway)</description>
    <rom name="pacman.6e" size="4096" crc="c1e6ab10"/>
  </machine>
  <machine name="pacmanf" cloneof="puckman" romof="puckman">
    <description>Pac-Man (Midway, speedup hack)</description>
    <rom name="pacmanf.6e" size="4096" crc="deadbeef"/>
  </machine>
  <machine name="mspacman">
    <description>Ms. Pac-Man</description>
    <rom name="mspac.6e" size="4096" crc="0a1b2c3d"/>
  </machine>
</datafile>
"""

REGION_DAT = """<?xml version="1.0"?>
<datafile>
  <header><name>Nintendo - Game Boy (World)</name></header>
  <game name="Lemmings (Japan)"><rom name="l.gb" crc="00000001"/></game>
  <game name="Lemmings (Europe)"><rom name="l.gb" crc="00000002"/></game>
  <game name="Lemmings (USA)"><rom name="l.gb" crc="00000003"/></game>
  <game name="Tetris (Europe)"><rom name="t.gb" crc="00000004"/></game>
</datafile>
"""


def test_cloneof_becomes_parent_name():
    _h, entries = parse_dat_bytes(PARENT_CLONE_DAT.encode(), source='mame')
    by_name = {e['name']: e for e in entries}
    assert by_name['Puck Man (Japan set 1)']['parent_name'] is None
    assert by_name['Pac-Man (Midway)']['parent_name'] == 'puckman'
    # The speedup hack peels to the same title as its sibling clone and collapses
    # onto it -- one row per title is the rule for every source.
    assert 'Pac-Man (Midway, speedup hack)' not in by_name and len(entries) == 3
    assert by_name['Ms. Pac-Man']['parent_name'] is None


def test_same_title_across_regions_keeps_the_preferred_region():
    _h, entries = parse_dat_bytes(REGION_DAT.encode(), source='nointro')
    names = [e['name'] for e in entries]
    # USA outranks Europe outranks Japan in REGION_PREF_ORDER; Tetris has one row.
    assert names == ['Lemmings (USA)', 'Tetris (Europe)']
    assert entries[0]['crc'] == '00000003'


def test_completion_view_counts_parents_only(db_session):
    ref = upsert_reference_set(
        library_platform='ARCADE',
        region='WORLD',
        source='mame',
        dat_bytes=PARENT_CLONE_DAT.encode(),
        name=f'clones {uuid4().hex[:6]}',
    )
    stored = db_session.execute(select(ReferenceSetEntry).filter_by(set_id=ref.id)).scalars().all()
    assert len(stored) == 3
    view = preferred_entries(ref.id)
    assert sorted(e.name for e in view) == ['Ms. Pac-Man', 'Puck Man (Japan set 1)']

    # A set with no clone data comes back whole.
    plain = upsert_reference_set(
        library_platform='GB',
        region='WORLD',
        source='nointro',
        dat_bytes=REGION_DAT.encode(),
        name=f'plain {uuid4().hex[:6]}',
    )
    assert len(preferred_entries(plain.id)) == 2


def test_clone_parent_lookup_by_hash_and_title(db_session):
    upsert_reference_set(
        library_platform='ARCADE',
        region='WORLD',
        source='mame',
        dat_bytes=PARENT_CLONE_DAT.encode(),
        name=f'clones {uuid4().hex[:6]}',
    )
    assert clone_parent_for(library_platform='ARCADE', crc='C1E6AB10') == 'puckman'
    assert clone_parent_for(library_platform='ARCADE', name='Pac-Man (Midway).zip') == 'puckman'
    # A parent is not a clone of anything; an unknown title neither.
    assert clone_parent_for(library_platform='ARCADE', crc='f36e88ab') is None
    assert clone_parent_for(library_platform='ARCADE', name='Galaga') is None
    assert clone_parent_for(library_platform='GB', crc='c1e6ab10') is None


def test_advisory_reason_has_a_plain_language_line():
    assert 'clone' in MATCH_REASON_SUMMARIES['clone_of_owned_parent'].lower()
