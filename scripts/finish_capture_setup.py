"""Advance local capture DB past incomplete setup (admin already exists)."""
from __future__ import annotations

import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from sqlalchemy import select

from oneirodex import create_app, db
from oneirodex.models import GlobalSettings, Library, LibraryPlatform
from oneirodex.utils.setup import (
    get_current_setup_step,
    is_setup_required,
    mark_setup_complete,
)


LIBS = [
    ("Free NES samples", "NES"),
    ("Free GB samples", "GB"),
    ("Free GBA samples", "GBA"),
    ("Free Genesis samples", "SEGA_MD"),
    ("Free Atari 2600 samples", "ATARI_2600"),
]


def main() -> None:
    app = create_app()
    with app.app_context():
        print("is_setup_required:", is_setup_required())
        print("current_setup_step:", get_current_setup_step())
        gs = db.session.execute(select(GlobalSettings)).scalars().first()
        if gs is None:
            gs = GlobalSettings()
            db.session.add(gs)
            db.session.commit()

        # Placeholder IGDB — enough to finish wizard; operator can replace later.
        gs.igdb_client_id = (gs.igdb_client_id or "").strip() or "capturelocalclientid0001"
        gs.igdb_client_secret = (gs.igdb_client_secret or "").strip() or "capturelocalsecret00001"
        gs.smtp_enabled = False
        db.session.commit()

        mark_setup_complete()

        # Prefer full seed helpers when InitManager export is healthy.
        try:
            from oneirodex.init_data import (
                initialize_allowed_file_types,
                initialize_default_settings,
                initialize_discovery_sections,
                initialize_library_folders,
                insert_default_scanning_filters,
            )

            initialize_library_folders()
            initialize_discovery_sections()
            insert_default_scanning_filters()
            initialize_default_settings()
            initialize_allowed_file_types()
        except Exception as exc:  # noqa: BLE001
            print("seed helpers skipped:", type(exc).__name__, exc)

        existing = {
            lib.name: lib
            for lib in db.session.execute(select(Library)).scalars().all()
        }
        for name, plat in LIBS:
            if name in existing:
                print("library exists:", name)
                continue
            lib = Library(
                name=name,
                platform=LibraryPlatform[plat],
                scan_depth=1,
                image_url="/static/newstyle/default_library.jpg",
            )
            db.session.add(lib)
            print("created library:", name, plat)
        db.session.commit()

        print("setup complete; step now:", get_current_setup_step())


if __name__ == "__main__":
    main()
