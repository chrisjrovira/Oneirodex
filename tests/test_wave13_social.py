"""Tests for lite social models (Wave 13) — no live DB required."""

from __future__ import annotations

from oneirodex.models import GlobalSettings, UserFriendship


def test_community_chat_columns_exist():
    assert hasattr(GlobalSettings, 'community_chat_url')
    assert hasattr(GlobalSettings, 'community_chat_label')


def test_user_friendship_model_shape():
    assert UserFriendship.__tablename__ == 'user_friendships'
    row = UserFriendship(user_id=1, friend_user_id=2, status='pending')
    payload = row.to_dict()
    assert payload['status'] == 'pending'
    assert payload['user_id'] == 1
    assert payload['friend_user_id'] == 2
