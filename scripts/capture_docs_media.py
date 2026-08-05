"""
Local media capture for docs (screenshots + short tour video).

Requires a running GameTheca on BASE_URL (default http://127.0.0.1:5006)
and Playwright Chromium (`pip install playwright && playwright install chromium`).

Blocks long-lived SSE (`/api/activity/stream`) so a single-worker uvicorn
does not stall during capture.

Usage:
  python scripts/capture_docs_media.py
"""
from __future__ import annotations

import os
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import TimeoutError as PwTimeout
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOT_DIR = ROOT / "docs" / "media" / "screenshots"
VIDEO_DIR = ROOT / "docs" / "media" / "video"
README_ASSETS = ROOT / "docs" / "assets" / "readme"

BASE = os.environ.get("CAPTURE_BASE_URL", "http://127.0.0.1:5006").rstrip("/")
USER = os.environ.get("CAPTURE_USER", "admin")
PASSWORD = os.environ.get("CAPTURE_PASS", "CaptureAdmin1!")


# Text that means the page failed. A shot of one of these must never reach a
# README slot — a broken frame shipped as product art is worse than a stale one.
_ERROR_MARKERS = (
    "internal server error",
    "500 internal server",
    "502 bad gateway",
    "503 service unavailable",
    "504 gateway",
    "not found",
    "traceback (most recent call last)",
    "werkzeug debugger",
)


def page_is_healthy(page) -> tuple[bool, str]:
    """True when the page looks like real UI rather than an error.

    Checked before every capture: a single 500 during a run would otherwise
    overwrite good pixels with an error page and sync it straight to the README.
    """
    try:
        body = (page.inner_text("body", timeout=5_000) or "").strip()
    except Exception as exc:  # noqa: BLE001
        return False, f"could not read body ({type(exc).__name__})"

    low = body.lower()
    for marker in _ERROR_MARKERS:
        # Short bodies only: "not found" legitimately appears in empty states.
        if marker in low and len(body) < 600:
            return False, f"error page ({marker!r})"
    if len(body) < 40:
        return False, f"page nearly empty ({len(body)} chars)"
    return True, "ok"


def _sync_readme(src: Path, dest_name: str) -> None:
    """Copy a media shot into the canonical README slot."""
    README_ASSETS.mkdir(parents=True, exist_ok=True)
    dest = README_ASSETS / dest_name
    dest.write_bytes(src.read_bytes())
    print("readme:", dest)


def _shot(page, name: str, also_readme: bool = False, readme_as: str | None = None) -> None:
    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    path = SHOT_DIR / f"{name}.png"
    page.screenshot(path=str(path), full_page=False, timeout=10_000)
    print("shot:", path)
    if also_readme or readme_as:
        README_ASSETS.mkdir(parents=True, exist_ok=True)
        dest_name = readme_as or f"{name}.png"
        page.screenshot(
            path=str(README_ASSETS / dest_name),
            full_page=False,
            timeout=10_000,
        )
        print("readme:", README_ASSETS / dest_name)


def _goto(page, path: str, timeout: int = 20_000) -> bool:
    url = f"{BASE}{path}"
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=timeout)
        page.wait_for_timeout(800)
        print("ok", path, "->", page.url)
        return True
    except Exception as exc:  # noqa: BLE001
        print("fail", path, type(exc).__name__, str(exc)[:160])
        return False


def login(page) -> None:
    _goto(page, "/login")
    page.fill("#username", USER)
    page.fill("#password", PASSWORD)
    page.locator('button[type="submit"], input[type="submit"]').first.click()
    page.wait_for_load_state("domcontentloaded", timeout=20_000)
    page.wait_for_timeout(1000)
    print("after login:", page.url)


def capture_tour(page) -> list[str]:
    # (path, media name, full_page, optional README slot filenames)
    pages = [
        ("/library", "library-free-roms", False, ("screenshot-library.png", "hero-banner.png")),
        ("/systems", "systems-platforms", False, ("screenshot-systems.png",)),
        ("/chat", "chat-channels", False, ("screenshot-chat.png",)),
        ("/discover", "discover", False, ()),
        ("/admin/ops", "admin-ops-services", False, ()),
        ("/admin/features", "admin-features", True, ()),
        ("/admin/integrations", "admin-integrations", True, ()),
        ("/libraries", "admin-libraries", True, ()),
    ]
    failures: list[str] = []
    for path, name, full, readme_slots in pages:
        if not _goto(page, path):
            failures.append(f"{path} (navigation)")
            continue
        healthy, why = page_is_healthy(page)
        if not healthy:
            # Keep whatever is already on disk rather than replacing it with this.
            print(f"SKIP {path}: {why} — existing {name}.png left untouched")
            failures.append(f"{path} ({why})")
            continue
        if path == "/library":
            # Default tile size leaves a sparse grid mostly empty on a small
            # library. Push it up so the hero frame is filled by artwork.
            try:
                slider = page.locator('input[type="range"]').first
                if slider.count() and slider.is_visible():
                    slider.fill("85")
                    page.wait_for_timeout(900)
            except Exception as exc:  # noqa: BLE001
                print("tile size:", exc)
        if path == "/chat":
            # Chat opens as a slide-out over the library; Expand gives it the
            # full pane so the shot is of chat rather than half a dark grid.
            try:
                expand = page.locator('button:has-text("Expand")').first
                if expand.count() and expand.is_visible():
                    expand.click(timeout=5_000)
                    page.wait_for_timeout(900)
            except Exception as exc:  # noqa: BLE001
                print("chat expand:", exc)
        if path == "/admin/ops":
            try:
                page.wait_for_selector("text=LiveKit", timeout=15_000)
                page.wait_for_timeout(500)
            except Exception as exc:  # noqa: BLE001
                print("ops wait:", exc)
        if path == "/chat":
            page.wait_for_timeout(1200)
        try:
            SHOT_DIR.mkdir(parents=True, exist_ok=True)
            path_png = SHOT_DIR / f"{name}.png"
            page.screenshot(path=str(path_png), full_page=full, timeout=15_000)
            print("shot:", path_png)
            for slot in readme_slots:
                _sync_readme(path_png, slot)
            # Keep legacy alias names for docs/media consumers
            if name == "library-free-roms":
                _sync_readme(path_png, "library-free-roms.png")
            if name == "admin-ops-services":
                _sync_readme(path_png, "admin-ops-services.png")
        except Exception as exc:  # noqa: BLE001
            print("shot fail", name, exc)

    if _goto(page, "/library") and page_is_healthy(page)[0]:
        try:
            page.keyboard.press("Control+K")
            page.wait_for_timeout(700)
            _shot(page, "command-palette", also_readme=True)
            page.keyboard.press("Escape")
        except Exception as exc:  # noqa: BLE001
            print("palette fail", exc)

    if failures:
        print("\n!! captures skipped (pixels NOT refreshed):")
        for item in failures:
            print("   -", item)
    return failures


def main() -> int:
    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=str(VIDEO_DIR),
            record_video_size={"width": 1920, "height": 1080},
        )
        # Prevent SSE / long-poll from pinning the single Flask worker.
        context.route(
            "**/api/activity/stream*",
            lambda route: route.fulfill(
                status=204,
                body="",
                headers={"content-type": "text/plain"},
            ),
        )
        context.route(
            "**/api/events/**",
            lambda route: route.fulfill(status=204, body=""),
        )
        page = context.new_page()
        page.set_default_timeout(20_000)
        skipped: list[str] = []
        try:
            login(page)
            skipped = capture_tour(page)
            # dwell for video
            _goto(page, "/library")
            page.keyboard.press("Control+K")
            page.wait_for_timeout(1200)
            page.keyboard.press("Escape")
            _goto(page, "/admin/ops")
            page.wait_for_timeout(1500)
            _goto(page, "/systems")
            page.wait_for_timeout(1200)
        except PwTimeout as exc:
            print("timeout:", exc)
            try:
                _shot(page, "capture-error")
            except Exception:  # noqa: BLE001
                pass
            return 1
        finally:
            video_path = page.video.path() if page.video else None
            context.close()
            browser.close()
            if video_path:
                src = Path(video_path)
                dest = VIDEO_DIR / "product-tour.webm"
                if src.exists():
                    if dest.exists():
                        dest.unlink()
                    src.rename(dest)
                    print("video:", dest)

    for probe in ("healthz", "readyz"):
        try:
            with urllib.request.urlopen(f"{BASE}/{probe}", timeout=5) as resp:
                (SHOT_DIR / f"{probe}.json").write_text(
                    resp.read().decode("utf-8"), encoding="utf-8"
                )
                print(f"saved {probe}.json")
        except Exception as exc:  # noqa: BLE001
            print(f"{probe} failed:", exc)

    print("done. shots in", SHOT_DIR)
    if skipped:
        # Non-zero so a partial run cannot be mistaken for a clean refresh.
        print(f"INCOMPLETE: {len(skipped)} surface(s) not refreshed")
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
