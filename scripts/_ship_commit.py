#!/usr/bin/env python3
"""Stage product files and commit. Does not write git config. No secrets."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO = Path(r"Z:\_projects\Oneirodex")
GIT = [
    "git",
    "-c",
    "safe.directory=*",
    "-c",
    "user.name=cephyrix_zyth",
    "-c",
    "user.email=cephyrix_zyth@users.noreply.github.com",
]

PATHS = [
    "CHANGELOG.md",
    "docker-compose.yml",
    "docs/admin/discover-sections.md",
    "docs/admin/libraries-and-scans.md",
    "docs/admin/settings-modules.md",
    "docs/admin/themes-reset.md",
    "docs/admin/troubleshooting.md",
    "docs/dev/ui-debt-log.md",
    "docs/runbooks/oidc-authentik-unraid.md",
    "docs/runbooks/unraid-deploy.md",
    "docs/user/faq.md",
    "docs/user/getting-started.md",
    "docs/user/library-and-systems.md",
    "frontend/admin-app/src/navConfig.js",
    "frontend/admin-app/src/pages.jsx",
    "frontend/admin-app/src/pages.settings.test.jsx",
    "frontend/admin-app/src/styles.css",
    "frontend/admin-app/src/useLibraryScanToasts.js",
    "frontend/admin-app/src/utils/toast.js",
    "frontend/admin-app/src/utils/toast.test.js",
    "frontend/member-app/src/DiscoverApp.jsx",
    "frontend/member-app/src/DiscoverApp.test.jsx",
    "frontend/member-app/src/chrome/SideRail.test.jsx",
    "frontend/member-app/src/chrome/railIcons.jsx",
    "frontend/member-app/src/components/DiscoverShelf.css",
    "frontend/member-app/src/components/DiscoverShelf.jsx",
    "frontend/member-app/src/components/NewsCard.css",
    "frontend/member-app/src/components/NewsCard.jsx",
    "frontend/member-app/src/components/hbarLayout.js",
    "frontend/member-app/src/components/hbarLayout.test.js",
    "frontend/member-app/src/components/useRowScroll.js",
    "frontend/member-app/src/components/useRowScroll.test.js",
    "frontend/member-app/src/hooks/useLibraryScanToasts.js",
    "frontend/member-app/src/hooks/useLibraryScanToasts.test.js",
    "frontend/member-app/src/pages/HelpPage.jsx",
    "frontend/member-app/src/utils/libraryScanNotify.grouping.test.js",
    "frontend/member-app/src/utils/libraryScanNotify.js",
    "frontend/member-app/src/utils/toast.js",
    "frontend/member-app/src/utils/toast.test.js",
    "frontend/member-app/src/utils/toastStack.test.js",
    "frontend/shared/libraryScanNotify.js",
    "frontend/shared/toastStack.js",
    "oneirodex/routes_discover.py",
    "oneirodex/setup/default_theme/css/od-era.css",
    "oneirodex/setup/default_theme/css/od-shell.css",
    "oneirodex/static/js/od_toast.js",
    "oneirodex/utils/preset_themes.py",
    "tests/test_discover_rows.py",
    "tests/test_gt_toast.py",
    "tests/test_member_chrome_css.py",
]

MESSAGE = """feat(unraid): ship Discover chrome, Settings hub, and Authentik SSO

Compose now forwards remaining OIDC and product-flag env so Unraid .env
modes reach the app. Login SSO is the local Authentik oneirodex client.
AI auto-apply and hardlink apply stay off.
"""


def run(args: list[str]) -> None:
    subprocess.check_call(GIT + args, cwd=REPO)


def main() -> int:
    run(["add", "--", *PATHS])
    staged = subprocess.check_output(GIT + ["diff", "--cached", "--name-only"], cwd=REPO).decode()
    print("=== staged ===")
    print(staged)
    forbidden = [line for line in staged.splitlines() if line == ".env" or "docs/_private" in line]
    if forbidden:
        print("REFUSING forbidden paths:", forbidden)
        return 2
    proc = subprocess.run(
        GIT + ["commit", "-F", "-"],
        cwd=REPO,
        input=MESSAGE.encode(),
    )
    return proc.returncode


if __name__ == "__main__":
    raise SystemExit(main())
