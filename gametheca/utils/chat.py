"""Household chat channels + DMs (Wave 15) + reactions/search (Wave 17)."""

from __future__ import annotations

import re
from collections import defaultdict

from sqlalchemy import select

from gametheca import db
from gametheca.models import (
    ChatChannel,
    ChatChannelMember,
    ChatMessage,
    ChatMessageReaction,
    User,
)
from gametheca.utils.custom_emoji import custom_reaction_keys
from gametheca.utils.notifications import notify_user
from gametheca.utils.rbac import normalize_role

MENTION_RE = re.compile(r'@([A-Za-z0-9_.-]{2,64})')
ALLOWED_REACTIONS = frozenset({'👍', '❤️', '😂', '🎉', '👀'})


def is_allowed_reaction(emoji: str) -> bool:
    key = (emoji or '').strip()
    if key in ALLOWED_REACTIONS:
        return True
    if key.startswith(':') and key.endswith(':') and len(key) >= 4:
        return key in custom_reaction_keys()
    return False


def ensure_default_channels() -> None:
    for slug, name, child_safe in (
        ('general', '#general', True),
        ('looking-for-players', '#looking-for-players', True),
    ):
        existing = db.session.execute(
            select(ChatChannel).where(ChatChannel.slug == slug),
        ).scalars().first()
        if existing:
            continue
        db.session.add(
            ChatChannel(
                kind='channel',
                name=name,
                slug=slug,
                is_child_safe=child_safe,
            )
        )
    db.session.commit()


def _is_member(channel_id: int, user_id: int) -> ChatChannelMember | None:
    return db.session.execute(
        select(ChatChannelMember).where(
            ChatChannelMember.channel_id == channel_id,
            ChatChannelMember.user_id == user_id,
        )
    ).scalars().first()


def ensure_channel_membership(channel: ChatChannel, user: User) -> ChatChannelMember:
    row = _is_member(channel.id, user.id)
    if row:
        return row
    row = ChatChannelMember(channel_id=channel.id, user_id=user.id)
    db.session.add(row)
    db.session.commit()
    return row


def user_can_access_channel(user: User, channel: ChatChannel) -> bool:
    role = normalize_role(getattr(user, 'role', None))
    if channel.kind == 'channel':
        if role == 'child' and not channel.is_child_safe:
            return False
        return True
    # DM: must be a member
    return _is_member(channel.id, user.id) is not None


def list_channels_for_user(user: User) -> list[dict]:
    ensure_default_channels()
    role = normalize_role(getattr(user, 'role', None))
    channels = db.session.execute(
        select(ChatChannel).order_by(ChatChannel.kind.asc(), ChatChannel.name.asc())
    ).scalars().all()
    out = []
    for ch in channels:
        if ch.kind == 'channel':
            if role == 'child' and not ch.is_child_safe:
                continue
            member = ensure_channel_membership(ch, user)
            payload = ch.to_dict()
            payload['muted'] = bool(member.muted)
            out.append(payload)
            continue
        member = _is_member(ch.id, user.id)
        if member:
            payload = ch.to_dict()
            payload['muted'] = bool(member.muted)
            out.append(payload)
    return out


def set_channel_muted(user: User, channel: ChatChannel, muted: bool) -> bool:
    """Persist per-user mute for a channel or DM the user can access."""
    if not user_can_access_channel(user, channel):
        raise PermissionError('Not found')
    if channel.kind == 'channel':
        member = ensure_channel_membership(channel, user)
    else:
        member = _is_member(channel.id, user.id)
        if member is None:
            raise PermissionError('Not found')
    member.muted = bool(muted)
    db.session.commit()
    return bool(member.muted)


def open_or_create_dm(user: User, other: User) -> ChatChannel:
    if user.id == other.id:
        raise ValueError('Cannot DM yourself')
    # Find existing DM with exactly these two members
    mine = {
        m.channel_id
        for m in db.session.execute(
            select(ChatChannelMember).where(ChatChannelMember.user_id == user.id)
        ).scalars().all()
    }
    theirs = {
        m.channel_id
        for m in db.session.execute(
            select(ChatChannelMember).where(ChatChannelMember.user_id == other.id)
        ).scalars().all()
    }
    for cid in mine & theirs:
        ch = db.session.get(ChatChannel, cid)
        if ch and ch.kind == 'dm':
            return ch
    names = sorted([user.name, other.name])
    ch = ChatChannel(
        kind='dm',
        name=f'{names[0]} / {names[1]}',
        slug=None,
        is_child_safe=True,
        created_by_user_id=user.id,
    )
    db.session.add(ch)
    db.session.flush()
    db.session.add(ChatChannelMember(channel_id=ch.id, user_id=user.id))
    db.session.add(ChatChannelMember(channel_id=ch.id, user_id=other.id))
    db.session.commit()
    return ch


def create_household_channel(
    creator: User,
    *,
    name: str,
    slug: str,
    is_child_safe: bool = True,
) -> ChatChannel:
    role = normalize_role(getattr(creator, 'role', None))
    if role not in ('admin', 'librarian'):
        raise PermissionError('Only admins/librarians can create channels')
    clean_slug = re.sub(r'[^a-z0-9-]', '', (slug or '').lower())[:64]
    if not clean_slug:
        raise ValueError('Invalid slug')
    if db.session.execute(select(ChatChannel).where(ChatChannel.slug == clean_slug)).scalars().first():
        raise ValueError('Channel already exists')
    ch = ChatChannel(
        kind='channel',
        name=(name or f'#{clean_slug}')[:120],
        slug=clean_slug,
        is_child_safe=bool(is_child_safe),
        created_by_user_id=creator.id,
    )
    db.session.add(ch)
    db.session.commit()
    ensure_channel_membership(ch, creator)
    return ch


def list_messages(
    channel_id: int,
    *,
    limit: int = 50,
    before_id: int | None = None,
    since_id: int | None = None,
    viewer_user_id: int | None = None,
) -> list[dict]:
    q = select(ChatMessage).where(ChatMessage.channel_id == channel_id)
    if since_id:
        # Incremental poll: newer than since_id, oldest-first within the window.
        q = q.where(ChatMessage.id > since_id)
        rows = list(
            db.session.execute(
                q.order_by(ChatMessage.id.asc()).limit(max(1, min(limit, 100)))
            ).scalars().all()
        )
    else:
        if before_id:
            q = q.where(ChatMessage.id < before_id)
        rows = list(
            db.session.execute(
                q.order_by(ChatMessage.id.desc()).limit(max(1, min(limit, 100)))
            ).scalars().all()
        )
        rows.reverse()
    reaction_map = _reactions_for_messages([m.id for m in rows], viewer_user_id=viewer_user_id)
    author_ids = {msg.user_id for msg in rows}
    authors: dict[int, User] = {}
    if author_ids:
        authors = {
            u.id: u
            for u in db.session.execute(select(User).where(User.id.in_(author_ids))).scalars().all()
        }
    out = []
    for msg in rows:
        author = authors.get(msg.user_id)
        meta = reaction_map.get(msg.id, {'reactions': {}, 'mine': []})
        out.append(
            msg.to_dict(
                author_name=getattr(author, 'name', None),
                reactions=meta['reactions'],
                mine=meta['mine'],
            )
        )
    return out


def _reactions_for_messages(
    message_ids: list[int],
    *,
    viewer_user_id: int | None,
) -> dict[int, dict]:
    if not message_ids:
        return {}
    rows = db.session.execute(
        select(ChatMessageReaction).where(ChatMessageReaction.message_id.in_(message_ids))
    ).scalars().all()
    counts: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    mine: dict[int, list[str]] = defaultdict(list)
    for row in rows:
        counts[row.message_id][row.emoji] += 1
        if viewer_user_id is not None and row.user_id == viewer_user_id:
            mine[row.message_id].append(row.emoji)
    return {
        mid: {'reactions': dict(counts[mid]), 'mine': mine.get(mid, [])}
        for mid in message_ids
    }


def toggle_reaction(message: ChatMessage, user: User, emoji: str) -> dict:
    emoji = (emoji or '').strip()
    if not is_allowed_reaction(emoji):
        raise ValueError('Unsupported emoji')
    channel = db.session.get(ChatChannel, message.channel_id)
    if not channel or not user_can_access_channel(user, channel):
        raise PermissionError('Forbidden')
    existing = db.session.execute(
        select(ChatMessageReaction).where(
            ChatMessageReaction.message_id == message.id,
            ChatMessageReaction.user_id == user.id,
            ChatMessageReaction.emoji == emoji,
        )
    ).scalars().first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        active = False
    else:
        db.session.add(
            ChatMessageReaction(message_id=message.id, user_id=user.id, emoji=emoji)
        )
        db.session.commit()
        active = True
    meta = _reactions_for_messages([message.id], viewer_user_id=user.id)[message.id]
    return {'active': active, 'reactions': meta['reactions'], 'mine': meta['mine']}


def search_messages(user: User, query: str, *, limit: int = 20) -> list[dict]:
    q = (query or '').strip()
    if len(q) < 2:
        raise ValueError('Query too short')
    if len(q) > 120:
        q = q[:120]
    pattern = f'%{q}%'
    rows = db.session.execute(
        select(ChatMessage)
        .where(ChatMessage.body.ilike(pattern))
        .order_by(ChatMessage.id.desc())
        .limit(max(1, min(limit, 50)))
    ).scalars().all()
    out = []
    for msg in rows:
        channel = db.session.get(ChatChannel, msg.channel_id)
        if not channel or not user_can_access_channel(user, channel):
            continue
        if channel.kind == 'dm' and not _is_member(channel.id, user.id):
            continue
        author = db.session.get(User, msg.user_id)
        out.append({
            'message': msg.to_dict(author_name=getattr(author, 'name', None)),
            'channel': channel.to_dict(),
        })
    return out


def post_message(
    channel: ChatChannel,
    user: User,
    body: str,
    *,
    parent_message_id: int | None = None,
) -> ChatMessage:
    text = (body or '').strip()
    if not text:
        raise ValueError('Message required')
    if len(text) > 4000:
        raise ValueError('Message too long')
    if not user_can_access_channel(user, channel):
        raise PermissionError('Forbidden')
    ensure_channel_membership(channel, user)
    parent_id = None
    if parent_message_id is not None:
        parent = db.session.get(ChatMessage, int(parent_message_id))
        if not parent or parent.channel_id != channel.id:
            raise ValueError('Invalid parent message')
        parent_id = parent.id
    msg = ChatMessage(
        channel_id=channel.id,
        user_id=user.id,
        body=text,
        parent_message_id=parent_id,
    )
    db.session.add(msg)
    db.session.commit()
    _fanout_mentions_and_dm(channel, user, msg)
    return msg


def mark_channel_read(channel_id: int, user_id: int, message_id: int) -> None:
    member = _is_member(channel_id, user_id)
    if not member:
        return
    if member.last_read_message_id is None or message_id > member.last_read_message_id:
        member.last_read_message_id = message_id
        db.session.commit()


def _fanout_mentions_and_dm(channel: ChatChannel, author: User, msg: ChatMessage) -> None:
    names = {m.group(1).lower() for m in MENTION_RE.finditer(msg.body)}
    notified: set[int] = set()
    if names:
        users = db.session.execute(select(User).where(User.name.in_(list(names)))).scalars().all()
        # case-insensitive fallback
        if not users:
            all_u = db.session.execute(select(User)).scalars().all()
            users = [u for u in all_u if u.name and u.name.lower() in names]
        for target in users:
            if target.id == author.id or target.id in notified:
                continue
            membership = _is_member(channel.id, target.id)
            if membership is not None and membership.muted:
                continue
            notify_user(
                target.id,
                kind='mention',
                title=f'{author.name} mentioned you',
                body=msg.body[:160],
                link='/chat',
                actor_user_id=author.id,
                payload={'channel_id': channel.id, 'message_id': msg.id},
                pref_flag='notify_mentions',
            )
            notified.add(target.id)
    if channel.kind == 'dm':
        members = db.session.execute(
            select(ChatChannelMember).where(
                ChatChannelMember.channel_id == channel.id,
                ChatChannelMember.user_id != author.id,
                ChatChannelMember.muted.is_(False),
            )
        ).scalars().all()
        for member in members:
            if member.user_id in notified:
                continue
            notify_user(
                member.user_id,
                kind='dm',
                title=f'Message from {author.name}',
                body=msg.body[:160],
                link='/chat',
                actor_user_id=author.id,
                payload={'channel_id': channel.id, 'message_id': msg.id},
                pref_flag='notify_chat',
            )
