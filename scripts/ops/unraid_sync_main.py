#!/usr/bin/env python3
"""Fast-forward the live Unraid/Windows checkout to origin/main.

Run this **on the household share** (Unraid terminal or Windows ``Z:\\_projects\\Oneirodex``).
Cloud agents cannot reach ``192.168.50.116``.

Never ``git reset --hard`` (that can wipe a live ``.env`` if it were ever tracked).
Never writes git config. Restores CRLF / file-mode-only dirt so SMB checkouts
can pull; refuses when tracked files have real content diffs.

Usage::

    python3 scripts/ops/unraid_sync_main.py
    python3 scripts/ops/unraid_sync_main.py --dry-run
    python3 scripts/ops/unraid_sync_main.py --ship
"""
from __future__ import annotations

import argparse
import importlib.util
import os
import subprocess
import sys
from pathlib import Path

_OPS = Path(__file__).resolve().parent
_HOST_PATH = _OPS / "unraid_host.py"
_spec = importlib.util.spec_from_file_location("unraid_host", _HOST_PATH)
if _spec is None or _spec.loader is None:
    raise RuntimeError(f"cannot load {_HOST_PATH}")
unraid_host = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(unraid_host)

DISK_FULL_PCT = unraid_host.DISK_FULL_PCT
LINUX_REPO = unraid_host.LINUX_REPO
THEME_RESET_REL = unraid_host.THEME_RESET_REL
classify_tracked_diffs = unraid_host.classify_tracked_diffs
clear_stale_index_lock = unraid_host.clear_stale_index_lock
discover_live_repo = unraid_host.discover_live_repo
git_argv = unraid_host.git_argv
parse_df_over_threshold = unraid_host.parse_df_over_threshold
ssh_argv = unraid_host.ssh_argv

OPERATOR_PASTE = r"""
# Run on Unraid terminal (or Git Bash on Z:\_projects\Oneirodex).
# Do NOT git reset --hard — that can destroy a live .env.
REPO=/mnt/user/infernal-data-streams/_projects/Oneirodex
# Windows: REPO=/z/_projects/Oneirodex   or   REPO='Z:\_projects\Oneirodex'
cd "$REPO" || exit 1
GIT="git -c safe.directory=$REPO"
df -h / /mnt/user /mnt/cache /var/lib/docker 2>/dev/null || df -h | head
$GIT status -sb
$GIT remote -v
# If status is a sea of modified files but `git diff --ignore-cr-at-eol` is empty,
# they are CRLF-only (Windows SMB). Restore those, keep real edits:
$GIT diff --name-only --diff-filter=ACMRD > /tmp/od-diff-all.txt
$GIT diff --ignore-cr-at-eol --name-only --diff-filter=ACMRD > /tmp/od-diff-real.txt
# Review /tmp/od-diff-real.txt before the next line. Abort if .env is listed.
if [ -s /tmp/od-diff-real.txt ]; then
  echo "REFUSING: tracked files have real diffs (not only CRLF):"
  cat /tmp/od-diff-real.txt
  exit 2
fi
if [ -s /tmp/od-diff-all.txt ]; then
  while IFS= read -r f; do
    [ -n "$f" ] && $GIT checkout -- "$f"
  done < /tmp/od-diff-all.txt
fi
$GIT fetch origin --prune
$GIT checkout main
$GIT merge --ff-only origin/main
$GIT log -1 --oneline
$GIT rev-parse HEAD origin/main
# Then, on Unraid (needs Docker), rebuild:
# python3 scripts/ops/unraid_ship_update_now.py
""".strip()


def _git_env() -> dict[str, str]:
    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"
    return env


def run_git(repo: Path, args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        git_argv(repo) + args,
        check=check,
        capture_output=True,
        text=True,
        env=_git_env(),
    )


def _print_cmd(proc: subprocess.CompletedProcess[str]) -> None:
    if proc.stdout:
        sys.stdout.write(proc.stdout)
        if not proc.stdout.endswith("\n"):
            sys.stdout.write("\n")
    if proc.stderr:
        sys.stderr.write(proc.stderr)
        if not proc.stderr.endswith("\n"):
            sys.stderr.write("\n")


def restore_paths(repo: Path, paths: list[str], *, chunk: int = 200) -> None:
    for i in range(0, len(paths), chunk):
        run_git(repo, ["checkout", "--", *paths[i : i + chunk]])


def check_disk_or_skip(repo: Path) -> None:
    if repo != LINUX_REPO:
        print("disk gate skipped (not the Unraid /mnt/user checkout; check array free space before --ship)")
        return
    try:
        proc = subprocess.run(
            ["df", "-P", "/", "/mnt/user", "/mnt/cache", "/var/lib/docker"],
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        print("disk gate skipped (df not found)")
        return
    text = proc.stdout or ""
    if not text.strip():
        print("disk gate skipped (df produced no rows)")
        return
    print("=== df ===")
    print(text.rstrip())
    hits = parse_df_over_threshold(text, threshold=DISK_FULL_PCT)
    if hits:
        detail = ", ".join(f"{m} {p}%" for m, p in hits)
        raise RuntimeError(
            f"host disk at or over {DISK_FULL_PCT}% ({detail}). "
            "Free array/cache/Docker space before pull or compose build."
        )


def sync_checkout(repo: Path, *, dry_run: bool = False) -> None:
    print(f"=== repo {repo} ===")
    print(f"=== {clear_stale_index_lock(repo)} ===")
    check_disk_or_skip(repo)

    status = run_git(repo, ["status", "-sb"])
    print("=== status -sb ===")
    _print_cmd(status)
    remote = run_git(repo, ["remote", "-v"])
    print("=== remote ===")
    _print_cmd(remote)

    noise, real = classify_tracked_diffs(repo)
    print(f"=== tracked noise (CRLF/mode/missing) {len(noise)} ===")
    for name in noise:
        print(name)
    print(f"=== tracked real diffs {len(real)} ===")
    for name in real:
        print(name)
    if real:
        raise RuntimeError(
            "tracked files have real diffs (not only line endings). "
            "Resolve those files without reset --hard and re-run. "
            ".env is gitignored and is never restored by this script."
        )
    if dry_run:
        print("=== dry-run: stopping before restore/fetch/merge ===")
        return
    if noise:
        print("=== restoring noise to HEAD ===")
        restore_paths(repo, noise)

    print("=== fetch origin --prune ===")
    fetch = run_git(repo, ["fetch", "origin", "--prune"], check=False)
    _print_cmd(fetch)
    if fetch.returncode != 0:
        raise RuntimeError(
            "git fetch failed. On the NAS, `git remote -v` should be "
            "https://github.com/chrisjrovira/oneirodex.git (the old "
            "chrisjrovira/Oneirodex URL still redirects). Fix credentials "
            "on the host; this script does not write tokens."
        )

    print("=== checkout main ===")
    checkout = run_git(repo, ["checkout", "main"], check=False)
    _print_cmd(checkout)
    if checkout.returncode != 0:
        created = run_git(repo, ["checkout", "-B", "main", "origin/main"], check=False)
        _print_cmd(created)
        if created.returncode != 0:
            raise RuntimeError("could not check out main (detached/divergent local state?)")

    print("=== merge --ff-only origin/main ===")
    merge = run_git(repo, ["merge", "--ff-only", "origin/main"], check=False)
    _print_cmd(merge)
    if merge.returncode != 0:
        raise RuntimeError(
            "fast-forward failed — local main has commits origin/main does not, "
            "or the tree is still dirty. Do not reset --hard. Inspect "
            "`git log --oneline main ^origin/main` on the NAS."
        )

    head = run_git(repo, ["rev-parse", "HEAD"]).stdout.strip()
    origin_main = run_git(repo, ["rev-parse", "origin/main"]).stdout.strip()
    log1 = run_git(repo, ["log", "-1", "--oneline"]).stdout.strip()
    print(f"=== HEAD {log1} ===")
    print(f"HEAD={head}")
    print(f"origin/main={origin_main}")
    if head != origin_main:
        raise RuntimeError("HEAD still does not match origin/main after ff-only merge")


def run_ship(repo: Path) -> int:
    theme = repo / THEME_RESET_REL
    if not theme.is_file():
        raise RuntimeError(f"missing {THEME_RESET_REL} — pull main before --ship")
    if repo != LINUX_REPO and not Path("/var/run/docker.sock").exists():
        print("=== --ship skipped here (needs Unraid Docker) ===")
        print("On the Unraid terminal, after this checkout matches origin/main:")
        print("  python3 scripts/ops/unraid_ship_update_now.py")
        return 0
    script = _OPS / "unraid_ship_update_now.py"
    print(f"=== ship via {script} ===")
    return subprocess.call([sys.executable, str(script)])


def _fail_not_on_nas() -> int:
    print("Live checkout is not mounted in this environment.")
    print("Expected Unraid:", LINUX_REPO)
    print("Expected Windows: Z:\\_projects\\Oneirodex")
    print("This cloud agent cannot open SSH to", ssh_argv()[-1], "(RFC1918).")
    print()
    print("Paste this on the Unraid terminal or on the Windows Z: checkout:")
    print()
    print(OPERATOR_PASTE)
    return 2


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo",
        type=Path,
        default=None,
        help="Override live checkout path (default: Unraid /mnt/user/… or Windows Z:)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Diagnose only: no restore, fetch, or merge",
    )
    parser.add_argument(
        "--ship",
        action="store_true",
        help="After a successful sync, run unraid_ship_update_now.py (Unraid Docker)",
    )
    args = parser.parse_args(argv)
    repo = args.repo.resolve() if args.repo is not None else discover_live_repo()
    if repo is None:
        return _fail_not_on_nas()
    if not repo.is_dir():
        print(f"repo path does not exist: {repo}")
        return 2
    try:
        sync_checkout(repo, dry_run=args.dry_run)
    except subprocess.CalledProcessError as exc:
        err = (exc.stderr or exc.stdout or "").strip() or str(exc)
        print(err)
        return 1
    except RuntimeError as exc:
        print(f"REFUSING: {exc}")
        return 2
    if args.ship and not args.dry_run:
        return run_ship(repo)
    return 0


if __name__ == "__main__":
    sys.exit(main())
