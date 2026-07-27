"""Lightweight plugin / connector registry (Wave 10–12)."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class PluginInfo:
    id: str
    name: str
    category: str
    description: str
    enabled: bool = True
    status: str = 'available'

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


_BUILTIN: list[PluginInfo] = [
    PluginInfo('provider.igdb', 'IGDB', 'metadata', 'Primary game metadata provider'),
    PluginInfo('provider.steamgriddb', 'SteamGridDB', 'metadata', 'Cover / hero art'),
    PluginInfo('arr.prowlarr', 'Prowlarr', 'acquire', 'BYO indexer manager'),
    PluginInfo('arr.jackett', 'Jackett', 'acquire', 'BYO indexer proxy'),
    PluginInfo('client.qbittorrent', 'qBittorrent', 'download', 'Primary torrent client'),
    PluginInfo('client.transmission', 'Transmission', 'download', 'Optional torrent client'),
    PluginInfo('client.deluge', 'Deluge', 'download', 'Optional torrent client'),
    PluginInfo('client.sabnzbd', 'SABnzbd', 'download', 'Optional Usenet client'),
    PluginInfo('client.nzbget', 'NZBGet', 'download', 'Optional Usenet client (RetroArr-class)'),
    PluginInfo('debrid.real_debrid', 'Real-Debrid', 'debrid', 'Magnet → cached HTTP'),
    PluginInfo('debrid.alldebrid', 'AllDebrid', 'debrid', 'Magnet → cached HTTP'),
    PluginInfo('debrid.premiumize', 'Premiumize', 'debrid', 'Optional third debrid'),
    PluginInfo('debrid.torbox', 'TorBox', 'debrid', 'Optional modern debrid API'),
    PluginInfo('emu.webretro', 'WebRetro', 'emulator', 'Browser WASM cores + cloud save bridge'),
    PluginInfo('emu.emulatorjs', 'EmulatorJS', 'emulator', 'Eval candidate — alternate WASM path'),
    PluginInfo('emu.retroarch', 'RetroArch', 'emulator', 'Native companion profiles'),
    PluginInfo('export.esde', 'ES-DE export', 'export', 'gamelist.xml packs'),
    PluginInfo('export.pegasus', 'Pegasus export', 'export', 'metadata.pegasus.txt'),
    PluginInfo('assist.packs', 'Assist packs', 'assists', 'Single-player companion toggles'),
    PluginInfo('mods.tracking', 'Mod tracking', 'mods', 'Per-game community mod lists'),
    PluginInfo('social.community_chat', 'Community chat link', 'social', 'BYO Stoat/Matrix deep-link'),
    PluginInfo('rtc.livekit', 'LiveKit voice', 'rtc', 'Optional household voice SFU (Wave 16)'),
    PluginInfo('remote_play.moonlight', 'Remote play', 'streaming', 'BYO Sunshine/Wolf Moonlight host'),
]


def _runtime_status_map() -> dict[str, str]:
    """Map plugin id → configured | available | disabled from live connectors."""
    status: dict[str, str] = {}
    try:
        from gametheca.utils.arr_connectors import connector_status
        for row in connector_status():
            cid = row.get('id')
            configured = bool(row.get('configured'))
            if cid == 'prowlarr':
                status['arr.prowlarr'] = 'configured' if configured else 'available'
            elif cid == 'jackett':
                status['arr.jackett'] = 'configured' if configured else 'available'
            elif cid == 'qbittorrent':
                status['client.qbittorrent'] = 'configured' if configured else 'available'
            elif cid == 'transmission':
                status['client.transmission'] = 'configured' if configured else 'available'
            elif cid == 'deluge':
                status['client.deluge'] = 'configured' if configured else 'available'
            elif cid == 'sabnzbd':
                status['client.sabnzbd'] = 'configured' if configured else 'available'
            elif cid == 'nzbget':
                status['client.nzbget'] = 'configured' if configured else 'available'
    except Exception:
        pass
    try:
        from gametheca.utils.debrid_connectors import debrid_status
        for row in debrid_status():
            pid = row.get('id') or row.get('provider')
            configured = bool(row.get('configured'))
            if not pid:
                continue
            key = f'debrid.{pid}' if not str(pid).startswith('debrid.') else str(pid)
            status[key] = 'configured' if configured else 'available'
    except Exception:
        pass
    try:
        from gametheca import db
        from gametheca.models import GlobalSettings
        from sqlalchemy import select
        row = db.session.execute(select(GlobalSettings).order_by(GlobalSettings.id).limit(1)).scalars().first()
        if row and getattr(row, 'community_chat_url', None):
            status['social.community_chat'] = 'configured'
        else:
            status['social.community_chat'] = 'available'
    except Exception:
        status['social.community_chat'] = 'available'
    try:
        from gametheca.utils.livekit_rtc import livekit_config, livekit_enabled
        cfg = livekit_config()
        if livekit_enabled() and cfg['url'] and cfg['api_key'] and cfg['api_secret']:
            status['rtc.livekit'] = 'configured'
        elif livekit_enabled():
            status['rtc.livekit'] = 'available'
        else:
            status['rtc.livekit'] = 'disabled'
    except Exception:
        status['rtc.livekit'] = 'available'
    try:
        from gametheca.utils.remote_play import get_remote_play_config, remote_play_enabled
        if remote_play_enabled() and get_remote_play_config().get('configured'):
            status['remote_play.moonlight'] = 'configured'
        elif remote_play_enabled():
            status['remote_play.moonlight'] = 'available'
        else:
            status['remote_play.moonlight'] = 'disabled'
    except Exception:
        status['remote_play.moonlight'] = 'available'
    status['emu.emulatorjs'] = 'eval'
    return status


def list_plugins(*, category: str | None = None) -> list[dict[str, Any]]:
    runtime = _runtime_status_map()
    rows = _BUILTIN
    if category:
        rows = [p for p in rows if p.category == category]
    out = []
    for plugin in rows:
        payload = plugin.to_dict()
        if plugin.id in runtime:
            payload['status'] = runtime[plugin.id]
        out.append(payload)
    return out


def get_plugin(plugin_id: str) -> dict[str, Any] | None:
    for plugin in _BUILTIN:
        if plugin.id == plugin_id:
            payload = plugin.to_dict()
            runtime = _runtime_status_map()
            if plugin_id in runtime:
                payload['status'] = runtime[plugin_id]
            return payload
    return None
