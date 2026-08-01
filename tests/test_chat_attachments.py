"""Wave 16 — chat message file/image attachments."""

from __future__ import annotations

from io import BytesIO
from uuid import uuid4

import pytest
from PIL import Image
from werkzeug.datastructures import FileStorage

from gametheca.models import User
from gametheca.utils.chat import create_household_channel, list_messages, post_message
from gametheca.utils.chat_attachments import (
    MAX_ATTACHMENT_BYTES,
    upload_attachment,
)


def _make_user(db_session, *, role: str, prefix: str) -> User:
    uid = str(uuid4())
    user = User(
        name=f'{prefix}_{uid[:8]}',
        email=f'{prefix}_{uid[:8]}@example.com',
        password_hash='hashed_password',
        role=role,
        user_id=uid,
        avatarpath='newstyle/avatar_default.jpg',
    )
    user.set_password('testpassword123')
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def member(db_session):
    return _make_user(db_session, role='user', prefix='att_member')


@pytest.fixture
def child(db_session):
    return _make_user(db_session, role='child', prefix='att_child')


def _png_file(name='shot.png', size=(32, 32)):
    buf = BytesIO()
    Image.new('RGBA', size, (0, 128, 255, 255)).save(buf, format='PNG')
    buf.seek(0)
    return FileStorage(stream=buf, filename=name, content_type='image/png')


def _txt_file(name='notes.txt', content=b'hello household'):
    return FileStorage(
        stream=BytesIO(content),
        filename=name,
        content_type='text/plain',
    )


def test_upload_and_attach_on_message(app, db_session, member, tmp_path, monkeypatch):
    with app.app_context():
        monkeypatch.setitem(app.config, 'UPLOAD_FOLDER', str(tmp_path))
        ch = create_household_channel(
            member,
            name='Attach room',
            slug=f'attach-{uuid4().hex[:8]}',
        )
        pending = upload_attachment(channel=ch, user=member, file=_png_file())
        assert pending.id
        assert pending.message_id is None
        payload = pending.to_dict()
        assert payload['mime'] == 'image/png'
        assert payload['url'].startswith('/static/library/chat-attachments/')
        assert payload['size'] > 0

        msg = post_message(
            ch,
            member,
            'see this',
            attachment_ids=[pending.id],
        )
        listed = list_messages(ch.id, viewer_user_id=member.id)
        row = next(m for m in listed if m['id'] == msg.id)
        assert row['body'] == 'see this'
        assert len(row['attachments']) == 1
        assert row['attachments'][0]['id'] == pending.id
        assert 'reactions' in row
        assert 'mine' in row


def test_attachment_only_message(app, db_session, member, tmp_path, monkeypatch):
    with app.app_context():
        monkeypatch.setitem(app.config, 'UPLOAD_FOLDER', str(tmp_path))
        ch = create_household_channel(
            member,
            name='File only',
            slug=f'fileonly-{uuid4().hex[:8]}',
        )
        pending = upload_attachment(channel=ch, user=member, file=_txt_file())
        msg = post_message(ch, member, '', attachment_ids=[pending.id])
        assert msg.body == ''
        listed = list_messages(ch.id, viewer_user_id=member.id)
        row = next(m for m in listed if m['id'] == msg.id)
        assert row['attachments'][0]['mime'] == 'text/plain'


def test_child_cannot_upload(app, db_session, child, member, tmp_path, monkeypatch):
    with app.app_context():
        monkeypatch.setitem(app.config, 'UPLOAD_FOLDER', str(tmp_path))
        ch = create_household_channel(
            member,
            name='Kid ACL',
            slug=f'kidacl-{uuid4().hex[:8]}',
        )
        with pytest.raises(PermissionError, match='Child'):
            upload_attachment(channel=ch, user=child, file=_png_file())


def test_size_reject(app, db_session, member, tmp_path, monkeypatch):
    with app.app_context():
        monkeypatch.setitem(app.config, 'UPLOAD_FOLDER', str(tmp_path))
        ch = create_household_channel(
            member,
            name='Size room',
            slug=f'size-{uuid4().hex[:8]}',
        )
        huge = FileStorage(
            stream=BytesIO(b'x' * (MAX_ATTACHMENT_BYTES + 1)),
            filename='big.txt',
            content_type='text/plain',
        )
        with pytest.raises(ValueError, match='too large'):
            upload_attachment(channel=ch, user=member, file=huge)


def test_unsupported_mime_reject(app, db_session, member, tmp_path, monkeypatch):
    with app.app_context():
        monkeypatch.setitem(app.config, 'UPLOAD_FOLDER', str(tmp_path))
        ch = create_household_channel(
            member,
            name='Mime room',
            slug=f'mime-{uuid4().hex[:8]}',
        )
        exe = FileStorage(
            stream=BytesIO(b'MZ'),
            filename='bad.exe',
            content_type='application/octet-stream',
        )
        with pytest.raises(ValueError, match='Unsupported'):
            upload_attachment(channel=ch, user=member, file=exe)


def test_message_requires_body_or_attachment(app, db_session, member):
    with app.app_context():
        ch = create_household_channel(
            member,
            name='Empty room',
            slug=f'empty-{uuid4().hex[:8]}',
        )
        with pytest.raises(ValueError, match='Message required'):
            post_message(ch, member, '')
