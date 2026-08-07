"""
Per-section how-to videos for the docs (Playwright screen recordings).

Where `capture_docs_media.py` takes stills and one continuous tour, this
records a **separate short video per section**, each walking a worked example:
open the thing, use it, show the result.

Design notes
------------
* One Playwright *context* per section, because Playwright records video per
  context — that is what gives us one file per topic instead of one long reel.
* Optional steps (a feature that is off, a title with no screenshots) **skip
  with a printed reason** rather than aborting the run. Missing footage is
  honest; fake footage is not.
* But a step the section is *about* is `required=True` and aborts it. Without
  that, "find a game in your library" could record a clip where nobody finds a
  game and still be counted among `recorded 10/10` — which is precisely what
  happened when the chrome changed and the walkthrough silently skipped both
  filters and opening a title.
* Deliberate dwells: a video that snaps between screens faster than a reader
  can follow teaches nothing. `BEAT` is the base rhythm.

Requires a running GameTheca and Playwright Chromium:
    pip install playwright && playwright install chromium

Usage:
    python scripts/capture_howto_videos.py            # all sections
    python scripts/capture_howto_videos.py library    # one or more by name
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
VIDEO_DIR = ROOT / "docs" / "media" / "video" / "howto"

BASE = os.environ.get("CAPTURE_BASE_URL", "http://127.0.0.1:5006").rstrip("/")
USER = os.environ.get("CAPTURE_USER", "admin")
PASSWORD = os.environ.get("CAPTURE_PASS", "CaptureAdmin1!")

# Base rhythm in ms. Slow enough to read a screen before it changes.
BEAT = 1100


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def goto(page, path: str) -> bool:
    try:
        page.goto(f"{BASE}{path}", wait_until="domcontentloaded", timeout=25_000)
        page.wait_for_timeout(BEAT)
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"    nav failed {path}: {type(exc).__name__}")
        return False


def beat(page, n: float = 1.0) -> None:
    page.wait_for_timeout(int(BEAT * n))


class MissingAffordance(RuntimeError):
    """A section could not do the thing the video exists to demonstrate."""


def click_first(page, selectors: list[str], label: str, *, required: bool = False,
                wait_ms: int = 8_000) -> bool:
    """Click the first selector that resolves. Returns False if none do.

    The UI has several equivalent affordances depending on viewport and role,
    so a section should not fail because one of them was renamed.

    Two things this used to get wrong.

    It checked visibility *immediately*. Under load the member SPA had not
    finished rendering by then, so a control that exists perfectly well was
    reported missing — that is how the library walkthrough came to skip both
    "filters" and "a game tile". It now waits for the first selector to become
    visible before giving up.

    And a missed affordance was only ever printed. The recorder then wrote the
    video and counted the section a success, so `recorded 10/10` could include
    a "find a game in your library" clip in which nobody finds a game. Anything
    a section is actually *about* passes ``required=True`` and raises instead.
    """
    deadline = wait_ms
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            try:
                loc.wait_for(state="visible", timeout=max(deadline, 1_000))
            except Exception:  # noqa: BLE001
                # Give the remaining selectors a short look rather than the
                # full wait each — they are alternates, not a queue of retries.
                deadline = 1_500
                continue
            loc.scroll_into_view_if_needed(timeout=3_000)
            beat(page, 0.4)
            loc.click(timeout=5_000)
            beat(page, 0.9)
            return True
        except Exception:  # noqa: BLE001
            deadline = 1_500
            continue
    if required:
        raise MissingAffordance(f"{label} — the section cannot demonstrate its subject")
    print(f"    skip: no affordance for {label}")
    return False


def login(page) -> bool:
    if not goto(page, "/login"):
        return False
    try:
        page.fill("#username", USER)
        beat(page, 0.3)
        page.fill("#password", PASSWORD)
        beat(page, 0.3)
        page.locator('button[type="submit"], input[type="submit"]').first.click()
        page.wait_for_load_state("domcontentloaded", timeout=25_000)
        beat(page)
        return "/login" not in page.url
    except Exception as exc:  # noqa: BLE001
        print(f"    login failed: {type(exc).__name__}")
        return False


# --------------------------------------------------------------------------
# sections — each is a worked example, not a tour of chrome
# --------------------------------------------------------------------------

def sec_library(page) -> None:
    """Find a game: browse, filter, resize tiles, open details."""
    goto(page, "/library")
    beat(page, 1.6)

    # Filters: the thing most people reach for first.
    click_first(page, [
        'button:has-text("Filters")', '[aria-label*="ilter"]', '.gt-filterbar button',
    ], "filters", required=True)
    beat(page, 1.4)

    # Tile size — visibly changes the grid, so it reads well on video.
    for sel in ['input[type="range"]', '.gt-tile-slider input']:
        try:
            slider = page.locator(sel).first
            if slider.count() and slider.is_visible():
                slider.fill("75")
                beat(page, 1.2)
                slider.fill("35")
                beat(page, 1.2)
                break
        except Exception:  # noqa: BLE001
            continue

    # Open the first real title.
    # `.gt-game-card` never existed — the class is `game-card`. It matched
    # nothing for as long as it has been here; the href selector is what has
    # actually been doing the work.
    click_first(page, [
        'a[href*="/game_details/"]', '.game-card a', '[data-testid="game-card"] a',
    ], "a game tile", required=True)
    beat(page, 2.2)


def sec_game_details(page) -> None:
    """Read a game page: details, versions, related media, screenshots."""
    goto(page, "/library")
    click_first(page, ['a[href*="/game_details/"]'], "a game tile", required=True)
    beat(page, 1.8)

    # Walk down the page the way a reader would.
    for _ in range(4):
        page.mouse.wheel(0, 420)
        beat(page, 0.85)

    # Related media popup, when this title has any (most will not).
    if click_first(page, ['.gt-relmedia__card'], "related media card"):
        beat(page, 2.0)
        page.keyboard.press("Escape")
        beat(page, 0.8)

    # Screenshot lightbox.
    if click_first(page, [
        '.gt-shots img', '[data-testid="screenshot"]', '.gt-screenshots img',
    ], "screenshot"):
        beat(page, 1.8)
        page.keyboard.press("Escape")
        beat(page, 0.6)


def sec_discover(page) -> None:
    """Discover as a storefront: shelves, curation, events."""
    goto(page, "/discover")
    beat(page, 2.0)
    for _ in range(5):
        page.mouse.wheel(0, 380)
        beat(page, 0.9)
    page.mouse.wheel(0, -1900)
    beat(page, 1.2)


def sec_systems(page) -> None:
    """Systems hub: browse by console family, check set completion."""
    goto(page, "/systems")
    beat(page, 2.0)
    for _ in range(3):
        page.mouse.wheel(0, 400)
        beat(page, 0.9)
    goto(page, "/systems/completion")
    beat(page, 2.0)


def sec_chat_spaces(page) -> None:
    """Chat: household rooms, and spaces with their own channels."""
    goto(page, "/chat")
    beat(page, 2.0)

    # Expand first — the slide-out is half-width by default, so the walkthrough
    # would otherwise show the library behind it for most of the frame.
    click_first(page, ['button:has-text("Expand")'], "expand")
    beat(page, 1.4)

    # Switch rooms, then into a space channel, so both concepts are shown.
    click_first(page, [
        'button:has-text("looking-for-players")', 'text=looking-for-players',
    ], "another room")
    beat(page, 1.8)
    click_first(page, [
        'button:has-text("#general")', 'text=#general',
    ], "a space channel")
    beat(page, 2.0)


def sec_preferences(page) -> None:
    """Make it yours: theme, icon pack, font.

    Preferences lives behind the account menu (top-right), not on the toolbar —
    so the walkthrough opens that menu first, the way a member would.
    """
    goto(page, "/library")
    beat(page, 0.8)

    opened = False
    if click_first(page, [
        'button[aria-label="Account menu"]', '.gt-topnav__menu-trigger',
    ], "account menu"):
        beat(page, 0.9)
        opened = click_first(page, [
            'a:has-text("Preferences")', 'a[href="/settings_panel"]',
        ], "preferences link")

    if not opened:
        # Command palette reaches the same panel.
        page.keyboard.press("Control+K")
        beat(page, 1.0)
        try:
            page.keyboard.type("Preferences", delay=70)
            beat(page, 1.2)
            page.keyboard.press("Enter")
        except Exception:  # noqa: BLE001
            pass

    beat(page, 2.2)
    for _ in range(3):
        page.mouse.wheel(0, 320)
        beat(page, 1.1)


def sec_command_palette(page) -> None:
    """Get anywhere fast: Ctrl/Cmd+K."""
    goto(page, "/library")
    beat(page, 0.8)
    page.keyboard.press("Control+K")
    beat(page, 1.2)
    try:
        page.keyboard.type("Systems", delay=90)
        beat(page, 1.4)
        page.keyboard.press("Enter")
        beat(page, 2.0)
    except Exception:  # noqa: BLE001
        page.keyboard.press("Escape")


def sec_admin_libraries(page) -> None:
    """Admin: add a library and run a scan."""
    goto(page, "/libraries")
    beat(page, 2.2)
    for _ in range(3):
        page.mouse.wheel(0, 380)
        beat(page, 0.9)
    goto(page, "/scan_management")
    beat(page, 2.2)


def sec_admin_discover(page) -> None:
    """Admin: arrange shelves and schedule an event."""
    goto(page, "/admin/discovery_sections")
    beat(page, 2.4)
    for _ in range(3):
        page.mouse.wheel(0, 360)
        beat(page, 0.9)


def sec_admin_ops(page) -> None:
    """Admin: is everything healthy?"""
    goto(page, "/admin/ops")
    try:
        page.wait_for_selector("text=LiveKit", timeout=12_000)
    except Exception:  # noqa: BLE001
        pass
    beat(page, 2.2)
    for _ in range(3):
        page.mouse.wheel(0, 380)
        beat(page, 0.9)


SECTIONS: list[tuple[str, str, object]] = [
    ("library", "Find a game in your library", sec_library),
    ("game-details", "Read a game page", sec_game_details),
    ("discover", "Discover — the storefront", sec_discover),
    ("systems", "Systems & set completion", sec_systems),
    ("chat-spaces", "Chat, rooms & spaces", sec_chat_spaces),
    ("preferences", "Themes, icons & fonts", sec_preferences),
    ("command-palette", "The command palette", sec_command_palette),
    ("admin-libraries", "Admin — libraries & scans", sec_admin_libraries),
    ("admin-discover", "Admin — shelves & events", sec_admin_discover),
    ("admin-ops", "Admin — ops health", sec_admin_ops),
]


def record(pw, name: str, title: str, fn) -> bool:
    """Record one section into its own file. Returns True on success."""
    browser = pw.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 1600, "height": 900},
        record_video_dir=str(VIDEO_DIR),
        record_video_size={"width": 1600, "height": 900},
    )
    # Long-lived streams would pin the single worker for the whole recording.
    context.route(
        "**/api/activity/stream*",
        lambda route: route.fulfill(status=204, body="", headers={"content-type": "text/plain"}),
    )
    context.route("**/api/events/**", lambda route: route.fulfill(status=204, body=""))

    page = context.new_page()
    page.set_default_timeout(15_000)
    ok = False
    try:
        if login(page):
            fn(page)
            beat(page, 1.2)
            ok = True
        else:
            print(f"    {name}: login failed, no video written")
    except Exception as exc:  # noqa: BLE001
        print(f"    {name}: {type(exc).__name__}: {str(exc)[:140]}")
    finally:
        src = Path(page.video.path()) if page.video else None
        context.close()
        browser.close()
        if src and src.exists():
            if ok:
                dest = VIDEO_DIR / f"howto-{name}.webm"
                if dest.exists():
                    dest.unlink()
                src.rename(dest)
                print(f"    video: {dest.relative_to(ROOT)}")
            else:
                # Never leave a half-broken recording lying around to be shipped.
                src.unlink()
    return ok


def main() -> int:
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    wanted = {a.lower() for a in sys.argv[1:]}
    todo = [s for s in SECTIONS if not wanted or s[0] in wanted]
    if not todo:
        print("no matching sections; known:", ", ".join(s[0] for s in SECTIONS))
        return 2

    done, failed = [], []
    with sync_playwright() as pw:
        for name, title, fn in todo:
            print(f"[{name}] {title}")
            (done if record(pw, name, title, fn) else failed).append(name)

    print(f"\nrecorded {len(done)}/{len(todo)} -> {VIDEO_DIR}")
    if failed:
        print("failed:", ", ".join(failed))
    return 0 if done else 1


if __name__ == "__main__":
    raise SystemExit(main())
