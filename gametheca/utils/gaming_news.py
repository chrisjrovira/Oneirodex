"""Fetch top gaming headlines from public RSS feeds (best-effort)."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from typing import Any
from urllib.request import Request, urlopen

FEED_URLS = (
    'https://www.polygon.com/rss/index.xml',
    'https://www.pcgamer.com/rss/',
    'https://www.rockpapershotgun.com/feed',
)

_TAG_RE = re.compile(r'<[^>]+>')


def _strip_html(text: str) -> str:
    return _TAG_RE.sub('', text or '').strip()


def _text(node: ET.Element | None) -> str:
    if node is None or node.text is None:
        return ''
    return node.text.strip()


def _parse_feed(xml_bytes: bytes, source: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return items

    # RSS 2.0
    for item in root.findall('.//item'):
        title = _text(item.find('title'))
        link = _text(item.find('link'))
        summary = _strip_html(_text(item.find('description')))
        published = _text(item.find('pubDate'))
        if title and link:
            items.append({
                'title': title[:240],
                'url': link,
                'summary': summary[:400],
                'published_at': published,
                'source': source,
            })

    # Atom
    ns = {'a': 'http://www.w3.org/2005/Atom'}
    for entry in root.findall('.//{http://www.w3.org/2005/Atom}entry') or root.findall('.//a:entry', ns):
        title = _text(entry.find('{http://www.w3.org/2005/Atom}title'))
        link_el = entry.find('{http://www.w3.org/2005/Atom}link')
        link = ''
        if link_el is not None:
            link = link_el.attrib.get('href') or _text(link_el)
        summary = _strip_html(
            _text(entry.find('{http://www.w3.org/2005/Atom}summary'))
            or _text(entry.find('{http://www.w3.org/2005/Atom}content'))
        )
        published = _text(entry.find('{http://www.w3.org/2005/Atom}updated')) or _text(
            entry.find('{http://www.w3.org/2005/Atom}published')
        )
        if title and link:
            items.append({
                'title': title[:240],
                'url': link,
                'summary': summary[:400],
                'published_at': published,
                'source': source,
            })

    return items


def fetch_gaming_headlines(*, limit: int = 12) -> list[dict[str, Any]]:
    collected: list[dict[str, Any]] = []
    for url in FEED_URLS:
        if len(collected) >= limit:
            break
        source = url.split('/')[2].replace('www.', '')
        try:
            req = Request(url, headers={'User-Agent': 'GameThecaNews/0.2'})
            with urlopen(req, timeout=6) as resp:
                xml_bytes = resp.read(512_000)
            collected.extend(_parse_feed(xml_bytes, source))
        except Exception:
            continue

    # De-dupe by URL
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for item in collected:
        key = item.get('url') or ''
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(item)
        if len(unique) >= limit:
            break
    return unique
