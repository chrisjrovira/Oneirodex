"""Server-rendered pages use the rail chrome, not the retired sidebar (GT-B2).

Jinja pages carried their own left sidebar while the member SPA carried two top
bars. That was the same split that let buttons and colours diverge, expressed as
layout: three surfaces, three chromes, no shared source. partials/rail.html now
emits the same markup and classes as the React SideRail, so od-shell.css styles
all three.

These render real routes rather than parsing the template, because the parts
most likely to break are the ones Jinja only evaluates at render time — the
feature gates around optional destinations and the auth/settings pages that
deliberately have no rail at all.

Every test takes `configured_install`. base.html gates its whole chrome on
`{% if not is_setup_mode and not hide_lhn %}`, so on a freshly truncated
database the rail is suppressed *and so is the sidebar* — which makes the
"old markup is gone" assertions pass for the wrong reason and the rail
assertions fail for one. The fixture supplies the past-the-wizard state these
tests actually mean to describe.

The target is /playromtest, which looks like an odd choice and is the correct
one. Only two *live* routes render a base.html page that receives the rail:
this one and the image editor. Everything else on base.html is login, settings
or setup, all of which set hide_lhn or is_setup_mode and are chrome-less by
design — and games/game_details.html, despite extending base.html, is a dead
template no route renders any more.

/library and /game_details are the obvious candidates and are both wrong: they
are member-SPA routes on base_empty.html, where React renders the rail
client-side and the server sends an empty mount that no server-side assertion
can see.
"""

from uuid import uuid4

import pytest

from oneirodex.models import User


@pytest.fixture
def member(db_session):
    unique_id = str(uuid4())[:8]
    user = User(
        user_id=str(uuid4()),
        name=f'TestMember_{unique_id}',
        email=f'member_{unique_id}@test.com',
        role='user',
        is_email_verified=True,
    )
    user.set_password('testpass123')
    db_session.add(user)
    db_session.commit()
    return user


def _login(client, user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(user.id)
        sess['_fresh'] = True


class TestRailReplacesSidebar:
    def test_member_page_renders_the_rail(self, client, member, configured_install):
        _login(client, member)
        html = client.get('/playromtest').get_data(as_text=True)

        assert 'class="od-rail"' in html
        assert 'od-rail__link' in html

    def test_retired_sidebar_markup_is_gone(self, client, member, configured_install):
        """The old chrome must not linger alongside the new one.

        Two navs in the DOM is worse than either alone: duplicate landmarks for
        screen readers, and sidebar.css still ships rules that would position
        the stale one over the content.
        """
        _login(client, member)
        html = client.get('/playromtest').get_data(as_text=True)

        assert 'id="sidebar"' not in html
        assert 'class="sidebar-link"' not in html
        assert 'id="toggleSidebar"' not in html

    def test_shell_grid_wraps_rail_and_content(self, client, member, configured_install):
        _login(client, member)
        html = client.get('/playromtest').get_data(as_text=True)

        assert 'class="od-shell"' in html
        # #content is reused as the grid's main area rather than renamed, so no
        # page template had to change.
        assert '<div id="content"' in html

    def test_rail_carries_the_destinations_the_sidebar_had(self, client, member, configured_install):
        _login(client, member)
        html = client.get('/playromtest').get_data(as_text=True)

        # Spot-check across every rail group, including ones that used to be
        # buried at the bottom of the sidebar list.
        for href in ('/library', '/downloads', '/collections', '/wishlist', '/big-picture'):
            assert href in html, f'rail is missing {href}'

    def test_auth_pages_have_no_rail(self, client, configured_install):
        """Login deliberately has no navigation — and no empty grid column."""
        html = client.get('/login').get_data(as_text=True)

        assert 'class="od-rail"' not in html
        assert 'class="od-shell"' not in html

    def test_rail_toggle_is_present_and_wired(self, client, member, configured_install):
        _login(client, member)
        html = client.get('/playromtest').get_data(as_text=True)

        assert 'id="od-rail-toggle"' in html
        assert 'id="od-shell"' in html
        # The toggle drives data-rail; the old .collapsed class pair is retired.
        assert 'data-rail' in html
