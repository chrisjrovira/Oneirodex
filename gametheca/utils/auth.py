from datetime import datetime, timezone
from functools import wraps
from flask import request, redirect, url_for, flash
from urllib.parse import urlparse as url_parse
from flask_login import current_user, login_user
from sqlalchemy import func, select
from gametheca.models import User, db
from gametheca import login_manager
from gametheca.utils.rbac import librarian_required, normalize_role  # noqa: F401 — re-export

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


def safe_next_url(next_page, *, fallback_endpoint='discover.discover'):
    """Return *next_page* if it is a same-site path, else the fallback.

    The previous check was ``urlparse(next).netloc != ''``, which passes
    ``/\\evil.com`` — empty netloc, but browsers normalise the leading ``/\\``
    to ``//`` and treat it as protocol-relative. So the rule is positive
    instead: it must be a path starting with exactly one ``/``, and carry no
    scheme or authority of its own.
    """
    fallback = url_for(fallback_endpoint)
    if not next_page or not isinstance(next_page, str):
        return fallback

    candidate = next_page.strip()
    if not candidate.startswith('/'):
        return fallback
    # '//host' and '/\host' are both authority forms to a browser.
    if candidate[1:2] in ('/', '\\'):
        return fallback

    parsed = url_parse(candidate)
    if parsed.scheme or parsed.netloc:
        return fallback
    return candidate

def _authenticate_and_redirect(username, password):
    user = db.session.execute(select(User).filter(func.lower(User.name) == func.lower(username))).scalars().first()
    
    if user and user.check_password(password):
        user.lastlogin = datetime.now(timezone.utc)
        db.session.commit()
        login_user(user, remember=True)
        
        return redirect(safe_next_url(request.args.get('next')))
    else:
        flash('Invalid username or password', 'error')
        return redirect(url_for('login.login'))

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        role = normalize_role(getattr(current_user, 'role', None) or '') if current_user.is_authenticated else ''
        if not current_user.is_authenticated or role != 'admin':
            flash("You must be an admin to access this page.", "danger")
            return redirect(url_for('login.login'))
        return f(*args, **kwargs)
    return decorated_function
