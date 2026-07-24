"""SVG share cards for playtime stats."""

from __future__ import annotations

import html
from xml.sax.saxutils import escape


def format_duration(total_seconds: int) -> str:
    seconds = max(0, int(total_seconds or 0))
    hours, rem = divmod(seconds, 3600)
    minutes = rem // 60
    if hours:
        return f'{hours}h {minutes}m'
    return f'{minutes}m'


def build_playtime_share_svg(
    *,
    username: str,
    game_name: str,
    total_seconds: int,
    session_count: int = 0,
) -> str:
    user = escape(html.unescape(username or 'Player')[:40])
    game = escape(html.unescape(game_name or 'Unknown game')[:48])
    duration = escape(format_duration(total_seconds))
    sessions = max(0, int(session_count or 0))

    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240" viewBox="0 0 640 240" role="img" aria-label="Playtime share card">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1f2e"/>
      <stop offset="100%" stop-color="#0d111a"/>
    </linearGradient>
  </defs>
  <rect width="640" height="240" rx="16" fill="url(#bg)"/>
  <rect x="24" y="24" width="8" height="192" rx="4" fill="#3d8bfd"/>
  <text x="52" y="64" fill="#8b9bb4" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="18">GameTheca playtime</text>
  <text x="52" y="110" fill="#f0f3f8" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="32" font-weight="700">{game}</text>
  <text x="52" y="150" fill="#c5d0e0" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="20">{user}</text>
  <text x="52" y="198" fill="#3d8bfd" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="28" font-weight="600">{duration}</text>
  <text x="220" y="198" fill="#8b9bb4" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="18">{sessions} sessions</text>
</svg>
'''
