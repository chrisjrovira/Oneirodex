"""Shared render helper for the member React SPA shell."""

from flask import render_template

from gametheca.utils.processors import get_global_settings


def render_member_spa(**extra):
    """Render site/member_spa.html with optional template extras.

    Nav flags (show_trailers, show_help_button, show_play_status, …) are
    merged from global settings here. Several blueprints also inject the same
    dict via a context processor, but member_bp historically did not — Jinja
    then treated the unset names as false and hid Help / Trailers on
    /systems, /chat, /collections, and the rest of that blueprint.
    Callers may still override individual keys through ``extra``.
    """
    ctx = get_global_settings()
    ctx.update(extra)
    return render_template('site/member_spa.html', **ctx)
