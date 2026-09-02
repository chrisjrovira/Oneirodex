"""Every metadata source the cascade uses must appear in Integrations (GT-B26).

`metadata_cascade` walks eight sources. The Integrations inventory listed four
of them, so the admin page told operators Oneirodex scraped IGDB and three
databases while it was in fact querying five more — Steam, GOG, Epic, itch.io
and RAWG — with no way to see or reason about them.

This is asserted against the cascade itself rather than a hand-written list. A
source added to the walk without an inventory row would otherwise be invisible
again, which is the exact failure being fixed.
"""

import pytest


def _cascade_source_ids() -> set[str]:
    from oneirodex.utils.metadata_cascade import CONSOLE_ORDER, PC_ORDER

    return {spec.id for spec in (*PC_ORDER, *CONSOLE_ORDER)}


def _inventory_ids(app) -> set[str]:
    from oneirodex.utils.integrations_inventory import build_integrations_inventory

    with app.app_context():
        return {row['id'] for row in build_integrations_inventory()}


def test_every_cascade_source_is_listed(app):
    """No silent scraper: what we query is what we show."""
    missing = sorted(_cascade_source_ids() - _inventory_ids(app))

    assert missing == [], (
        f'these sources are queried by metadata_cascade but absent from '
        f'Integrations: {missing}'
    )


def test_cascade_covers_more_than_igdb(app):
    """Guards the headline complaint — scraping must not be IGDB-only."""
    sources = _cascade_source_ids()

    assert 'igdb' not in sources or len(sources) > 1
    assert len(sources) >= 5, f'expected a real cascade, got {sorted(sources)}'


def test_keyless_sources_report_as_usable(app):
    """A keyless public endpoint is usable, not 'unconfigured'.

    Reporting Steam or RAWG as unconfigured would read as broken on a working
    install, since there is no credential for an operator to supply.
    """
    from oneirodex.utils.integrations_inventory import build_integrations_inventory

    with app.app_context():
        rows = {r['id']: r for r in build_integrations_inventory()}

    for source in ('steam', 'gog', 'epic', 'itch', 'rawg'):
        assert source in rows, f'{source} missing from inventory'
        assert rows[source]['configured'] is True, (
            f'{source} is keyless and should report as usable'
        )


@pytest.mark.parametrize('source', ['steam', 'gog', 'epic', 'itch', 'rawg'])
def test_new_sources_are_metadata_category(app, source):
    """They belong with the other scrapers, not in a category of their own."""
    from oneirodex.utils.integrations_inventory import build_integrations_inventory

    with app.app_context():
        rows = {r['id']: r for r in build_integrations_inventory()}

    assert rows[source]['category'] == 'metadata'
