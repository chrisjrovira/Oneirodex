"""Live Unraid / Windows checkout paths and git helpers.

Does not write git config. Callers pass ``-c safe.directory=`` per invocation.
The cloud agent workspace is **not** the live stack — only the household
paths below (or an explicit ``--repo``) count.
"""
from __future__ import annotations

from pathlib import Path
import subprocess
import time

LINUX_REPO = Path("/mnt/user/infernal-data-streams/_projects/Oneirodex")
WINDOWS_REPO = Path(r"Z:\_projects\Oneirodex")
SSH_TARGET = "root@192.168.50.116"
THEME_RESET_REL = "scripts/ops/unraid_reset_themes.py"
DISK_FULL_PCT = 99
STALE_INDEX_LOCK_SEC = 120
PROTECTED_PATHS = frozenset({".env", ".env.bak"})
DF_MOUNTS = ("/", "/mnt/user", "/mnt/cache", "/var/lib/docker")


def git_argv(repo: Path) -> list[str]:
    resolved = str(repo)
    return ["git", "-c", f"safe.directory={resolved}", "-C", resolved]


def is_git_checkout(path: Path) -> bool:
    git = path / ".git"
    return git.is_dir() or git.is_file()


def discover_live_repo() -> Path | None:
    """Return the household checkout if it is mounted here.

    Does **not** fall back to cwd. A cloud / laptop clone must not be treated
    as the Unraid Compose tree.
    """
    for candidate in (LINUX_REPO, WINDOWS_REPO):
        if is_git_checkout(candidate):
            return candidate
    return None


def ssh_argv(*, connect_timeout: int = 8) -> list[str]:
    return [
        "ssh",
        "-o",
        "BatchMode=yes",
        "-o",
        f"ConnectTimeout={connect_timeout}",
        SSH_TARGET,
    ]


def lf(data: bytes) -> bytes:
    return data.replace(b"\r\n", b"\n").replace(b"\r", b"\n")


def classify_tracked_diffs(repo: Path) -> tuple[list[str], list[str]]:
    """Split tracked diffs into (noise, real_content).

    Noise is CRLF / lone CR / file-mode only (LF-normalized bytes match HEAD),
    or a missing tracked file. Real content means the working tree bytes differ
    after LF normalization. ``.env`` is never classified as noise.
    """
    git = git_argv(repo)
    listed = subprocess.check_output(
        git + ["diff", "--name-only", "--diff-filter=ACMRD"],
        stderr=subprocess.DEVNULL,
    ).decode().splitlines()
    noise: list[str] = []
    real: list[str] = []
    for name in listed:
        if name in PROTECTED_PATHS:
            real.append(name)
            continue
        path = repo / name
        try:
            head = subprocess.check_output(
                git + ["show", f"HEAD:{name}"],
                stderr=subprocess.DEVNULL,
            )
        except subprocess.CalledProcessError:
            real.append(name)
            continue
        if not path.is_file():
            noise.append(name)
            continue
        work = path.read_bytes()
        if lf(head) == lf(work):
            noise.append(name)
        else:
            real.append(name)
    return noise, real


def git_dir(repo: Path) -> Path:
    git = repo / ".git"
    if git.is_dir():
        return git
    if git.is_file():
        for line in git.read_text(encoding="utf-8").splitlines():
            if line.lower().startswith("gitdir:"):
                raw = Path(line.split(":", 1)[1].strip())
                return raw if raw.is_absolute() else (repo / raw).resolve()
    raise FileNotFoundError(f"not a git checkout: {repo}")


def index_lock_path(repo: Path) -> Path:
    return git_dir(repo) / "index.lock"


def lock_age_sec(lock: Path) -> float | None:
    if not lock.exists():
        return None
    return time.time() - lock.stat().st_mtime


def clear_stale_index_lock(repo: Path, *, max_age_sec: int = STALE_INDEX_LOCK_SEC) -> str:
    """Remove a leftover ``index.lock`` older than ``max_age_sec``.

    A fresh lock means git is running — refuse rather than steal it.
    Returns a short status string for the operator log.
    """
    lock = index_lock_path(repo)
    age = lock_age_sec(lock)
    if age is None:
        return "no index.lock"
    if age < max_age_sec:
        raise RuntimeError(
            f"{lock} is {age:.0f}s old (git may still be running). "
            f"Wait, or remove it only if no git process holds the repo."
        )
    lock.unlink()
    return f"removed stale index.lock ({age:.0f}s old)"


def parse_df_over_threshold(
    df_text: str,
    *,
    threshold: int = DISK_FULL_PCT,
    mounts: tuple[str, ...] = DF_MOUNTS,
) -> list[tuple[str, int]]:
    """Return ``(mount, use_pct)`` rows at or over ``threshold``.

    Parses POSIX ``df -P`` (header + rows; capacity is the ``NN%`` field).
    Mounts that do not appear in the table are ignored.
    """
    wanted = set(mounts)
    hits: list[tuple[str, int]] = []
    for raw in df_text.splitlines()[1:]:
        parts = raw.split()
        if len(parts) < 6:
            continue
        mount = parts[-1]
        cap = parts[-2]
        if mount not in wanted:
            continue
        if not cap.endswith("%"):
            continue
        try:
            pct = int(cap[:-1])
        except ValueError:
            continue
        if pct >= threshold:
            hits.append((mount, pct))
    return hits
