"""Lightweight plugin / connector registry (Wave 10)."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Callable


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
    PluginInfo('debrid.real_debrid', 'Real-Debrid', 'debrid', 'Magnet → cached HTTP'),
    PluginInfo('debrid.alldebrid', 'AllDebrid', 'debrid', 'Magnet → cached HTTP'),
    PluginInfo('debrid.premiumize', 'Premiumize', 'debrid', 'Optional third debrid'),
    PluginInfo('debrid.torbox', 'TorBox', 'debrid', 'Optional modern debrid API'),
    PluginInfo('emu.webretro', 'WebRetro', 'emulator', 'Browser WASM cores'),
    PluginInfo('emu.retroarch', 'RetroArch', 'emulator', 'Native companion profiles'),
    PluginInfo('export.esde', 'ES-DE export', 'export', 'gamelist.xml packs'),
    PluginInfo('export.pegasus', 'Pegasus export', 'export', 'metadata.pegasus.txt'),
    PluginInfo('assist.packs', 'Assist packs', 'assists', 'Single-player companion toggles'),
    PluginInfo('mods.tracking', 'Mod tracking', 'mods', 'Per-game community mod lists'),
]


def list_plugins(*, category: str | None = None) -> list[dict[str, Any]]:
    rows = _BUILTIN
    if category:
        rows = [p for p in rows if p.category == category]
    return [p.to_dict() for p in rows]


def get_plugin(plugin_id: str) -> dict[str, Any] | None:
    for plugin in _BUILTIN:
        if plugin.id == plugin_id:
            return plugin.to_dict()
    return None
