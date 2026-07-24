"""Flask-Babel i18n helpers for GameTheca."""

from __future__ import annotations

from flask import request, session
from flask_babel import Babel
from flask_login import current_user

SUPPORTED_LOCALES = ('en', 'es')
DEFAULT_LOCALE = 'en'

babel = Babel()


def normalize_locale(value: str | None) -> str:
    if not value:
        return DEFAULT_LOCALE
    code = str(value).strip().lower().replace('_', '-')
    if code in SUPPORTED_LOCALES:
        return code
    short = code.split('-', 1)[0]
    if short in SUPPORTED_LOCALES:
        return short
    return DEFAULT_LOCALE


def select_locale() -> str:
    """Resolve locale: query → cookie → user preference → Accept-Language → default."""
    arg = request.args.get('lang') or request.args.get('locale')
    if arg:
        return normalize_locale(arg)

    cookie = request.cookies.get('gt_locale')
    if cookie:
        return normalize_locale(cookie)

    if current_user.is_authenticated:
        prefs = getattr(current_user, 'preferences', None)
        if prefs and getattr(prefs, 'locale', None):
            return normalize_locale(prefs.locale)

    sess = session.get('locale')
    if sess:
        return normalize_locale(sess)

    best = request.accept_languages.best_match(SUPPORTED_LOCALES)
    return normalize_locale(best)


def init_babel(app) -> Babel:
    app.config.setdefault('BABEL_DEFAULT_LOCALE', DEFAULT_LOCALE)
    app.config.setdefault('BABEL_TRANSLATION_DIRECTORIES', 'translations')
    babel.init_app(app, locale_selector=select_locale)
    return babel
