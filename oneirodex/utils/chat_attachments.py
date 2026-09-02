"""Household chat message attachments (Wave 16) — upload then attach on send.

ACL (channel access + child upload ban) is enforced by callers
(``routes_apis.chat`` / ``utils.chat.post_message``).
"""

from __future__ import annotations

import os
from uuid import uuid4

from flask import current_app
from sqlalchemy import func, select
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from oneirodex import db
from oneirodex.models import ChatChannel, ChatMessageAttachment, User
from oneirodex.utils.rbac import normalize_role

# Max bytes per file (5 MiB). Keep small — household library volume, not a CDN.
MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
MAX_ATTACHMENTS_PER_MESSAGE = 5
MAX_PENDING_PER_USER_CHANNEL = 10

# Extension → canonical MIME (content-type header is not trusted alone).
ALLOWED_BY_EXT: dict[str, str] = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'txt': 'text/plain',
    'csv': 'text/csv',
    'pdf': 'application/pdf',
}

ALLOWED_MIME = frozenset(ALLOWED_BY_EXT.values())


def attachments_dir() -> str:
    root = current_app.config.get('UPLOAD_FOLDER') or ''
    path = os.path.join(root, 'chat-attachments')
    os.makedirs(path, exist_ok=True)
    return path


def user_can_upload_attachments(user: User) -> bool:
    """Child accounts cannot upload (matches RTC screenshare / request gates)."""
    return normalize_role(getattr(user, 'role', None)) != 'child'


def upload_attachment(
    *,
    channel: ChatChannel,
    user: User,
    file: FileStorage,
) -> ChatMessageAttachment:
    """Persist a pending attachment for ``channel``. Caller must enforce channel ACL."""
    if not user_can_upload_attachments(user):
        raise PermissionError('Child accounts cannot upload attachments')

    if not file or not getattr(file, 'filename', None):
        raise ValueError('File required')

    filename = secure_filename(file.filename or '')
    if not filename or '.' not in filename:
        raise ValueError('Invalid filename')
    ext = filename.rsplit('.', 1)[-1].lower()
    if ext not in ALLOWED_BY_EXT:
        raise ValueError(
            'Unsupported file type (allowed: png, jpg, webp, gif, txt, csv, pdf)'
        )
    mime = ALLOWED_BY_EXT[ext]

    pending = int(
        db.session.execute(
            select(func.count())
            .select_from(ChatMessageAttachment)
            .where(
                ChatMessageAttachment.channel_id == channel.id,
                ChatMessageAttachment.uploaded_by_user_id == user.id,
                ChatMessageAttachment.message_id.is_(None),
            )
        ).scalar()
        or 0
    )
    if pending >= MAX_PENDING_PER_USER_CHANNEL:
        raise ValueError(
            f'Too many pending uploads (max {MAX_PENDING_PER_USER_CHANNEL}); '
            'send a message or wait'
        )

    raw = file.read(MAX_ATTACHMENT_BYTES + 1)
    if not raw:
        raise ValueError('Empty file')
    if len(raw) > MAX_ATTACHMENT_BYTES:
        raise ValueError(f'File too large (max {MAX_ATTACHMENT_BYTES // (1024 * 1024)}MB)')

    # Normalize jpeg extension for stable URLs.
    store_ext = 'jpg' if ext == 'jpeg' else ext
    out_name = f'{uuid4().hex}.{store_ext}'
    out_path = os.path.join(attachments_dir(), out_name)
    with open(out_path, 'wb') as fh:
        fh.write(raw)

    original = filename[:255] or out_name
    row = ChatMessageAttachment(
        channel_id=channel.id,
        message_id=None,
        uploaded_by_user_id=user.id,
        file_name=out_name,
        original_name=original,
        mime=mime,
        size_bytes=len(raw),
    )
    db.session.add(row)
    db.session.commit()
    return row


def attachments_for_messages(message_ids: list[int]) -> dict[int, list[dict]]:
    if not message_ids:
        return {}
    rows = db.session.execute(
        select(ChatMessageAttachment)
        .where(ChatMessageAttachment.message_id.in_(message_ids))
        .order_by(ChatMessageAttachment.id.asc())
    ).scalars().all()
    out: dict[int, list[dict]] = {mid: [] for mid in message_ids}
    for row in rows:
        if row.message_id is not None:
            out.setdefault(row.message_id, []).append(row.to_dict())
    return out


def bind_attachments_to_message(
    *,
    channel: ChatChannel,
    user: User,
    message_id: int,
    attachment_ids: list[int],
) -> list[ChatMessageAttachment]:
    """Attach previously uploaded pending files to a message. Order preserved."""
    if not attachment_ids:
        return []
    if len(attachment_ids) > MAX_ATTACHMENTS_PER_MESSAGE:
        raise ValueError(f'Max {MAX_ATTACHMENTS_PER_MESSAGE} attachments per message')

    seen: set[int] = set()
    ordered: list[int] = []
    for raw_id in attachment_ids:
        try:
            aid = int(raw_id)
        except (TypeError, ValueError) as exc:
            raise ValueError('Invalid attachment_ids') from exc
        if aid in seen:
            continue
        seen.add(aid)
        ordered.append(aid)

    if len(ordered) > MAX_ATTACHMENTS_PER_MESSAGE:
        raise ValueError(f'Max {MAX_ATTACHMENTS_PER_MESSAGE} attachments per message')

    rows = list(
        db.session.execute(
            select(ChatMessageAttachment).where(ChatMessageAttachment.id.in_(ordered))
        ).scalars().all()
    )
    by_id = {r.id: r for r in rows}
    bound: list[ChatMessageAttachment] = []
    for aid in ordered:
        row = by_id.get(aid)
        if row is None:
            raise ValueError('Attachment not found')
        if row.channel_id != channel.id:
            raise ValueError('Attachment channel mismatch')
        if row.uploaded_by_user_id != user.id:
            raise PermissionError("Cannot attach another user's upload")
        if row.message_id is not None and row.message_id != message_id:
            raise ValueError('Attachment already used')
        row.message_id = message_id
        bound.append(row)
    db.session.commit()
    return bound
