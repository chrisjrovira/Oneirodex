"""Wave 17 chat reactions + search (DB-free unit tests)."""

from __future__ import annotations

from gametheca.utils.chat import ALLOWED_REACTIONS, MENTION_RE


def test_allowed_reactions_fixed_set():
    assert '👍' in ALLOWED_REACTIONS
    assert '❤️' in ALLOWED_REACTIONS
    assert len(ALLOWED_REACTIONS) == 5


def test_mention_regex_still_works():
    names = {m.group(1) for m in MENTION_RE.finditer('hey @alice')}
    assert names == {'alice'}


def test_wave17_helpers_importable():
    from gametheca.utils.chat import search_messages, toggle_reaction

    assert callable(toggle_reaction)
    assert callable(search_messages)


def test_chat_reaction_model_importable():
    from gametheca.models import ChatMessageReaction

    assert ChatMessageReaction.__tablename__ == 'chat_message_reactions'
