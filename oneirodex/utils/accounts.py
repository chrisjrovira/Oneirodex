"""Accounts an admin creates by hand, with no email address.

Not every member has an address the household wants to use — a child's console
login, a shared living-room account, a guest. The invite flow assumed one
existed, and so did admin user creation, so "just make them an account" was not
something an admin could actually do.

``User.email`` is ``nullable=False, unique=True``, and a lot of code reads it
without checking (login by email, password reset, the digest mailer, OIDC
linking). Relaxing the column would push a ``None`` into all of them. So an
emailless account gets a placeholder in ``.invalid`` — the TLD RFC 2606 reserves
precisely so that it can never resolve and never receive mail — and every
surface that shows an address asks :func:`is_placeholder_email` first, so the
placeholder is never presented as somewhere to write to.
"""

from __future__ import annotations

import re
from uuid import uuid4

# RFC 2606 §2 guarantees `.invalid` is never delegated. A typo'd real domain
# could belong to somebody; this one cannot.
PLACEHOLDER_EMAIL_DOMAIN = 'no-email.invalid'


def placeholder_email(username: str | None = None) -> str:
    """A unique, unroutable address for an account created without one.

    The username is only a readability aid — the uuid is what guarantees the
    uniqueness the column requires, since two accounts may be created without
    an address for the same person and usernames can be renamed later.
    """
    slug = re.sub(r'[^a-z0-9]+', '-', (username or '').lower()).strip('-')
    prefix = f'{slug}.' if slug else ''
    return f'{prefix}{uuid4().hex[:12]}@{PLACEHOLDER_EMAIL_DOMAIN}'


def is_placeholder_email(email: str | None) -> bool:
    """True when this address exists only to satisfy the NOT NULL constraint."""
    if not email:
        return True
    return email.strip().lower().endswith(f'@{PLACEHOLDER_EMAIL_DOMAIN}')


def display_email(email: str | None) -> str | None:
    """The address to show a human — ``None`` when there is not really one."""
    return None if is_placeholder_email(email) else email
