"""Seed free-ROM Game rows for local capture (no IGDB/scan required)."""
from __future__ import annotations

import os
import sys
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import select

from oneirodex import create_app, db
from oneirodex.models import Game, Library

# folder under DATA_FOLDER_GAMES → library name keyword
ENTRIES = [
    ("NES", "nestest", "NES", "nestest"),
    ("GB", "dmg-acid2", "GB", "dmg-acid2"),
    ("GBA", "CASCADE7", "GBA", "CASCADE7"),
    ("Genesis", "genmddj", "Genesis", "genmddj"),
    ("Atari2600", "paddle-tester", "Atari", "paddle-tester"),
]


def main() -> None:
    games_root = Path(os.environ.get("DATA_FOLDER_GAMES") or ROOT / "data" / "games-capture")
    app = create_app()
    with app.app_context():
        libs = list(db.session.execute(select(Library)).scalars().all())
        by_kw = []
        for plat_dir, game_dir, kw, name in ENTRIES:
            folder = games_root / plat_dir / game_dir
            roms = [
                p
                for p in folder.iterdir()
                if p.is_file() and not p.name.endswith(".LICENSE.txt")
            ] if folder.is_dir() else []
            if not roms:
                print("missing rom:", folder)
                continue
            lib = next((L for L in libs if kw.lower() in L.name.lower()), None)
            if not lib:
                print("missing library for", kw)
                continue
            existing = db.session.execute(
                select(Game).filter_by(name=name, library_uuid=lib.uuid)
            ).scalars().first()
            if existing:
                print("exists:", name)
                continue
            g = Game(
                uuid=str(uuid4()),
                name=name,
                library_uuid=lib.uuid,
                full_disk_path=str(roms[0].resolve()),
                size=roms[0].stat().st_size,
                times_downloaded=0,
            )
            db.session.add(g)
            print("seeded:", name, "->", lib.name)
        db.session.commit()


if __name__ == "__main__":
    main()
