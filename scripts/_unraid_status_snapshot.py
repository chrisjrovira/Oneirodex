"""Print Unraid library / scan counts for the chrome pickup canvas."""

from __future__ import annotations

from sqlalchemy import func, select, text

from oneirodex import create_app, db
from oneirodex.models import Game, Library, ScanJob, user_favorites


def main() -> None:
    app = create_app()
    with app.app_context():
        libs = db.session.execute(select(func.count()).select_from(Library)).scalar_one()
        plats = db.session.execute(
            select(func.count(func.distinct(Library.platform)))
        ).scalar_one()
        games = db.session.execute(select(func.count()).select_from(Game)).scalar_one()
        favs = db.session.execute(select(func.count()).select_from(user_favorites)).scalar_one()
        rows = db.session.execute(
            select(ScanJob.status, func.count())
            .group_by(ScanJob.status)
            .order_by(ScanJob.status)
        ).all()
        print(f'libraries={libs}')
        print(f'platforms={plats}')
        print(f'games={games}')
        print(f'favorites={favs}')
        for status, count in rows:
            print(f'scan:{status}={count}')
        # Sample platforms with zero games (still scanning)
        zero = db.session.execute(
            text(
                """
                SELECT l.platform::text, count(g.id) AS n
                FROM libraries l
                LEFT JOIN games g ON g.library_uuid = l.uuid
                GROUP BY l.platform
                HAVING count(g.id) = 0
                ORDER BY 1
                LIMIT 12
                """
            )
        ).all()
        print('zero_game_platforms=' + ','.join(p for p, _ in zero))


if __name__ == '__main__':
    main()
