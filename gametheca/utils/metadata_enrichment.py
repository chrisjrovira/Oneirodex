from sqlalchemy import select

from gametheca import db
from gametheca.models import Genre, PlayerPerspective


def _get_or_create_perspective(persp_name):
    persp_obj = db.session.execute(
        select(PlayerPerspective).filter_by(name=persp_name)
    ).scalar_one_or_none()
    if not persp_obj:
        persp_obj = PlayerPerspective(name=persp_name)
        db.session.add(persp_obj)
    return persp_obj


def _get_or_create_genre(genre_name):
    genre_obj = db.session.execute(
        select(Genre).filter_by(name=genre_name)
    ).scalar_one_or_none()
    if not genre_obj:
        genre_obj = Genre(name=genre_name)
        db.session.add(genre_obj)
    return genre_obj


def _attach_named_relations(game_obj, enriched, perspective_factory=None, genre_factory=None):
    get_perspective = perspective_factory or _get_or_create_perspective
    get_genre = genre_factory or _get_or_create_genre

    if enriched.get('player_perspectives'):
        for persp_name in enriched['player_perspectives']:
            if not persp_name:
                continue
            persp_obj = get_perspective(persp_name)
            if persp_obj not in game_obj.player_perspectives:
                game_obj.player_perspectives.append(persp_obj)

    if enriched.get('genres'):
        for genre_name in enriched['genres']:
            if not genre_name:
                continue
            genre_obj = get_genre(genre_name)
            if genre_obj not in game_obj.genres:
                game_obj.genres.append(genre_obj)


def apply_enriched_metadata(game_obj, enriched, perspective_factory=None, genre_factory=None):
    """Apply enrichment (already fetched over HTTP) inside a SAVEPOINT.

    Returns False if the savepoint was rolled back due to an error, so
    partially-applied secondary metadata never corrupts the caller's
    outer transaction. The caller remains responsible for the outer
    `db.session.commit()`.
    """
    if not game_obj or not enriched:
        return True
    try:
        with db.session.begin_nested():
            if not game_obj.summary and enriched.get('summary'):
                game_obj.summary = enriched['summary']
            _attach_named_relations(
                game_obj, enriched,
                perspective_factory=perspective_factory,
                genre_factory=genre_factory,
            )
        return True
    except Exception as e:
        print(f"Metadata enrichment savepoint rollback: {e}")
        return False
