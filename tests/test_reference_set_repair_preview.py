"""INSP-24 / H1f: the DAT repair preview -- a dry run that sorts owned files
into rename candidates, hash mismatches, clone-named files and unknowns."""
from __future__ import annotations

from uuid import uuid4

import pytest
from flask_login import login_user

from oneirodex.models import Game, Library, User
from oneirodex.platform import LibraryPlatform
from oneirodex.utils.set_completion import upsert_reference_set
from oneirodex.utils.set_repair import repair_preview

# A parent/clone No-Intro style DAT: games named in full, clones point at the
# parent's full name.
DAT = """<?xml version="1.0"?>
<datafile>
  <header><name>Repair fixture</name></header>
  <game name="Puck Man (Japan set 1)">
    <rom name="pm1.6e" crc="f36e88ab" md5="11111111111111111111111111111111"/>
  </game>
  <game name="Pac-Man (Midway)" cloneof="Puck Man (Japan set 1)">
    <rom name="pacman.6e" crc="c1e6ab10"/>
  </game>
  <game name="Ms. Pac-Man">
    <rom name="mspac.6e" crc="0a1b2c3d"/>
  </game>
  <game name="Galaga">
    <rom name="galaga.6e" crc="aaaaaaaa"/>
  </game>
</datafile>
"""

# The same four as a MAME set: descriptions name the game, files carry the
# machine short name, so a hash hit is verified and never a rename.
MAME_DAT = """<?xml version="1.0"?>
<datafile>
  <header><name>Repair fixture (mame)</name></header>
  <machine name="puckman"><description>Puck Man (Japan set 1)</description><rom name="pm1.6e" crc="f36e88ab"/></machine>
  <machine name="mspacman"><description>Ms. Pac-Man</description><rom name="mspac.6e" crc="0a1b2c3d"/></machine>
</datafile>
"""


@pytest.fixture
def admin(db_session):
    uid = str(uuid4())
    row = User(name=f'adm_{uid[:8]}', email=f'adm_{uid[:8]}@example.com', role='admin', user_id=uid, state=True)
    row.set_password('password123')
    db_session.add(row)
    db_session.commit()
    return row


def _login(client, app, user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(user.get_id())
        sess['_fresh'] = True
    with app.test_request_context():
        login_user(user)


@pytest.fixture
def shelf(db_session, tmp_path):
    """One ARCADE library with one file per bucket."""
    upsert_reference_set(
        library_platform='ARCADE', region='WORLD', source='nointro',
        dat_bytes=DAT.encode(), name=f'repair {uuid4().hex[:6]}',
    )
    lib = Library(name=f'Arcade_{uuid4().hex[:6]}', platform=LibraryPlatform.ARCADE)
    db_session.add(lib)
    db_session.flush()

    def game(name, file_name, **hashes):
        row = Game(uuid=str(uuid4()), name=name, library_uuid=lib.uuid, full_disk_path=str(tmp_path / file_name), **hashes)
        db_session.add(row)
        return row

    rows = {
        # hash right, name wrong -> rename candidate
        'rename': game('Puck Man', 'puckman_v2_final.zip', file_crc='F36E88AB'),
        # hash right, name right -> verified
        'verified': game('Ms. Pac-Man', 'Ms. Pac-Man.zip', file_crc='0a1b2c3d'),
        # name right, hash wrong -> hash mismatch
        'mismatch': game('Galaga', 'Galaga.zip', file_crc='deadbeef'),
        # name right, never hashed -> counted, not reported
        'unhashed': game('Galaga', 'galaga.zip'),
        # clone entry, parent owned above
        'clone': game('Pac-Man (Midway)', 'Pac-Man (Midway).zip', file_crc='c1e6ab10'),
        # nothing in the set
        'unknown': game('Homebrew Thing', 'homebrew.zip', file_crc='12345678'),
    }
    db_session.commit()
    return rows


def test_repair_preview_sorts_every_owned_file(db_session, admin, shelf):
    report = repair_preview(library_platform='ARCADE', region='WORLD', user=admin)
    assert report is not None and report['dry_run'] is True
    assert report['owned_total'] == 6
    assert report['verified'] == 1
    assert report['unhashed_name_matches'] == 1
    assert report['counts'] == {'rename_candidates': 1, 'hash_mismatches': 1, 'clone_named': 1, 'unknown': 1}

    rename = report['rename_candidates'][0]
    assert rename['game_uuid'] == shelf['rename'].uuid
    assert rename['suggested_name'] == 'Puck Man (Japan set 1)' and rename['matched_by'] == 'crc'

    mismatch = report['hash_mismatches'][0]
    assert mismatch['game_uuid'] == shelf['mismatch'].uuid
    assert mismatch['entry_crc'] == 'aaaaaaaa' and mismatch['file_crc'] == 'deadbeef'

    clone = report['clone_named'][0]
    assert clone['clone_of'] == 'Puck Man (Japan set 1)' and clone['parent_owned'] is True

    assert report['unknown'][0]['game_uuid'] == shelf['unknown'].uuid
    assert report['truncated'] is False


def test_repair_preview_caps_rows_and_reports_truncation(db_session, admin, shelf, tmp_path):
    lib = db_session.get(Library, shelf['unknown'].library_uuid)
    for i in range(3):
        db_session.add(Game(uuid=str(uuid4()), name=f'Mystery {i}', library_uuid=lib.uuid, full_disk_path=str(tmp_path / f'm{i}.zip')))
    db_session.commit()
    report = repair_preview(library_platform='ARCADE', region=None, user=admin, limit=2)
    assert report['counts']['unknown'] == 4
    assert len(report['unknown']) == 2 and report['truncated'] is True


def test_mame_sets_never_propose_renames(db_session, admin, tmp_path):
    upsert_reference_set(
        library_platform='ARCADE', region='JAPAN', source='mame',
        dat_bytes=MAME_DAT.encode(), name=f'mame {uuid4().hex[:6]}',
    )
    lib = Library(name=f'Mame_{uuid4().hex[:6]}', platform=LibraryPlatform.ARCADE)
    db_session.add(lib)
    db_session.flush()
    db_session.add(Game(uuid=str(uuid4()), name='puckman', library_uuid=lib.uuid, full_disk_path=str(tmp_path / 'puckman.zip'), file_crc='f36e88ab'))
    db_session.commit()
    report = repair_preview(library_platform='ARCADE', region='JAPAN', user=admin)
    assert report['counts']['rename_candidates'] == 0
    assert report['verified'] >= 1


def test_repair_preview_none_without_a_set(admin):
    assert repair_preview(library_platform='GBA', region='USA', user=admin) is None
    with pytest.raises(ValueError):
        repair_preview(library_platform='NOT_A_PLATFORM', region=None, user=admin)


def test_repair_preview_route_is_admin_validated_and_dry(client, app, admin, shelf):
    resp = client.post('/api/reference-sets/repair-preview', json={'library_platform': 'ARCADE'})
    assert resp.status_code in (302, 401, 403)

    _login(client, app, admin)
    resp = client.post('/api/reference-sets/repair-preview', json={'library_platform': 'ARCADE', 'region': 'WORLD'})
    assert resp.status_code == 200, resp.get_json()
    body = resp.get_json()
    assert body['ok'] is True and body['dry_run'] is True
    assert body['counts']['rename_candidates'] == 1

    resp = client.post('/api/reference-sets/repair-preview', json={'library_platform': 'ARCADE', 'rename': True})
    assert resp.status_code == 422

    resp = client.post('/api/reference-sets/repair-preview', json={'library_platform': 'GBA'})
    assert resp.status_code == 404
    assert resp.get_json()['error_code'] == 'not_found'
