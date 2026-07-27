#!/usr/bin/env python3
"""Download legal free/open-source sample ROMs listed in samples/free-roms/manifest.yaml.

Stdlib only (no PyYAML required). Cross-platform. Binaries land under
samples/free-roms/library/ (gitignored). Never use this for commercial dumps.

Usage:
  python scripts/fetch-free-roms.py
  python scripts/fetch-free-roms.py --dry-run
  python scripts/fetch-free-roms.py --out /path/to/library
"""

from __future__ import annotations

import argparse
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "samples" / "free-roms" / "manifest.yaml"
DEFAULT_OUT = ROOT / "samples" / "free-roms" / "library"

USER_AGENT = "GameTheca-fetch-free-roms/1.0 (+https://github.com/chrisjrovira/gametheca)"


def _strip_comment(line: str) -> str:
    in_single = False
    in_double = False
    out: list[str] = []
    for ch in line:
        if ch == "'" and not in_double:
            in_single = not in_single
            out.append(ch)
        elif ch == '"' and not in_single:
            in_double = not in_double
            out.append(ch)
        elif ch == "#" and not in_single and not in_double:
            break
        else:
            out.append(ch)
    return "".join(out).rstrip()


def _parse_scalar(raw: str) -> str:
    s = raw.strip()
    if not s:
        return ""
    if len(s) >= 2 and ((s[0] == s[-1] == '"') or (s[0] == s[-1] == "'")):
        return s[1:-1]
    return s


def load_simple_manifest(path: Path) -> dict[str, Any]:
    """Minimal YAML subset: top-level maps + list-of-maps with scalar fields."""
    data: dict[str, Any] = {"roms": [], "skipped": []}
    section: str | None = None
    current: dict[str, str] | None = None

    def flush_item() -> None:
        nonlocal current
        if section and current:
            data[section].append(current)
        current = None

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = _strip_comment(raw)
        if not line.strip():
            continue
        stripped = line.strip()

        if stripped.startswith("version:"):
            flush_item()
            section = None
            data["version"] = _parse_scalar(stripped.split(":", 1)[1])
            continue

        if stripped in ("roms:", "skipped:"):
            flush_item()
            section = stripped[:-1]
            continue

        if stripped.startswith("- ") and section in ("roms", "skipped"):
            flush_item()
            current = {}
            rest = stripped[2:].strip()
            if ":" in rest:
                k, v = rest.split(":", 1)
                current[k.strip()] = _parse_scalar(v)
            continue

        if current is not None and ":" in stripped and (raw.startswith("  ") or raw.startswith("\t")):
            k, v = stripped.split(":", 1)
            current[k.strip()] = _parse_scalar(v)
            continue

    flush_item()
    return data


def download(url: str, dest: Path, timeout: float = 90.0) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        data = resp.read()
    dest.write_bytes(data)


def write_license_note(rom_path: Path, entry: dict[str, str]) -> Path:
    note_path = Path(str(rom_path) + ".LICENSE.txt")
    body = (
        f"File: {rom_path.name}\n"
        f"Platform: {entry.get('platform', '')}\n"
        f"License: {entry.get('license', '')}\n"
        f"Source: {entry.get('source', '')}\n"
        f"URL: {entry.get('url', '')}\n"
        f"Notes: {entry.get('notes', '')}\n"
        "\n"
        "Fetched by GameTheca scripts/fetch-free-roms.py for legal emulator smoke tests.\n"
        "Do not redistribute commercial dumps. See samples/free-roms/README.md.\n"
    )
    note_path.write_text(body, encoding="utf-8")
    return note_path


def print_layout_hint(out_dir: Path, platforms: list[str]) -> None:
    print()
    print("Suggested GameTheca library layout (Unraid / Compose games mount = /storage):")
    print()
    print("  Host (after fetch):")
    for p in platforms:
        print(f"    {out_dir.as_posix()}/{p}/")
    print()
    print("  Inside container / library roots:")
    for p in platforms:
        print(f"    /storage/{p}/")
    print()
    print("  Copy or symlink ROM files into those folders, then Admin -> Libraries ->")
    print("  point each library at /storage/<platform>/ and scan.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--manifest",
        type=Path,
        default=DEFAULT_MANIFEST,
        help=f"manifest path (default: {DEFAULT_MANIFEST})",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help=f"download root (default: {DEFAULT_OUT})",
    )
    parser.add_argument("--dry-run", action="store_true", help="list planned downloads only")
    args = parser.parse_args(argv)

    if not args.manifest.is_file():
        print(f"ERROR: manifest not found: {args.manifest}", file=sys.stderr)
        return 1

    try:
        import yaml  # type: ignore

        with args.manifest.open(encoding="utf-8") as fh:
            manifest = yaml.safe_load(fh)
    except ImportError:
        manifest = load_simple_manifest(args.manifest)

    roms = list(manifest.get("roms") or [])
    skipped = list(manifest.get("skipped") or [])

    if not roms and not skipped:
        print("ERROR: manifest has no roms/skipped entries", file=sys.stderr)
        return 1

    print(f"Manifest: {args.manifest}")
    print(f"Output:   {args.out}")
    if args.dry_run:
        print("(dry-run)")
    print()

    ok: list[str] = []
    failed: list[tuple[str, str]] = []
    platforms: list[str] = []

    for entry in roms:
        platform = str(entry.get("platform") or "unknown").strip()
        filename = str(entry.get("filename") or "").strip()
        url = str(entry.get("url") or "").strip()
        rid = str(entry.get("id") or filename).strip()
        if not filename or not url:
            failed.append((rid, "missing filename or url"))
            continue
        dest = args.out / platform / filename
        platforms.append(platform)
        print(f"-> {platform}/{filename}")
        print(f"  {url}")
        if args.dry_run:
            ok.append(f"{platform}/{filename}")
            continue
        try:
            download(url, dest)
            write_license_note(dest, {k: str(v) for k, v in entry.items()})
            size = dest.stat().st_size
            print(f"  OK ({size} bytes) + LICENSE note")
            ok.append(f"{platform}/{filename}")
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as exc:
            print(f"  FAIL: {exc}")
            failed.append((f"{platform}/{filename}", str(exc)))

    if skipped:
        print()
        print("Skipped platforms (no clear legal fetch URL in manifest):")
        for item in skipped:
            plat = item.get("platform", "?")
            note = (item.get("note") or "").strip().replace("\n", " ")
            print(f"  - {plat}: {note}")

    print()
    print(f"Downloaded: {len(ok)}")
    for name in ok:
        print(f"  OK {name}")
    if failed:
        print(f"Failed: {len(failed)}")
        for name, err in failed:
            print(f"  FAIL {name}: {err}")

    uniq = sorted(set(platforms))
    if uniq and not args.dry_run:
        print_layout_hint(args.out, uniq)

    return 1 if failed and not args.dry_run else 0


if __name__ == "__main__":
    raise SystemExit(main())
