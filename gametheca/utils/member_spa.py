"""Shared render helper for the member React SPA shell."""

from flask import render_template


def render_member_spa(**extra):
    """Render site/member_spa.html with optional template extras.

    Enable flags (show_trailers, show_help_button, enable_vr_browse) are
    already injected via the global settings context processor.
    """
    return render_template('site/member_spa.html', **extra)
