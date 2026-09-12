"""Live Unraid/Windows checkout repair — no NAS, no Docker."""
from __future__ import annotations

import importlib.util
import os
import subprocess
import time
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
OPS = REPO_ROOT / "scripts" / "ops"


def load_ops(name: str):
    path = OPS / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


host = load_ops("unraid_host")
sync = load_ops("unraid_sync_main")


def git(repo: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    ident = ["-c", "user.email=ops@test", "-c", "user.name=ops"]
    return subprocess.run(
        ["git", *ident, "-C", str(repo), *args],
        check=check,
        capture_output=True,
        text=True,
    )


def init_pair(tmp_path: Path) -> tuple[Path, Path]:
    origin = tmp_path / "origin.git"
    nas = tmp_path / "nas"
    subprocess.run(
        ["git", "init", "--bare", "-b", "main", str(origin)],
        check=True,
        capture_output=True,
        text=True,
    )
    subprocess.run(
        ["git", "clone", str(origin), str(nas)],
        check=True,
        capture_output=True,
        text=True,
    )
    git(nas, "config", "user.email", "ops@test")
    git(nas, "config", "user.name", "ops")
    git(nas, "config", "core.autocrlf", "false")
    (nas / "README").write_text("one\n", encoding="utf-8")
    git(nas, "add", "README")
    git(nas, "commit", "-m", "init")
    git(nas, "push", "-u", "origin", "main")
    return origin, nas


def origin_ahead(origin: Path, tmp_path: Path) -> None:
    other = tmp_path / "other"
    subprocess.run(
        ["git", "clone", str(origin), str(other)],
        check=True,
        capture_output=True,
        text=True,
    )
    git(other, "config", "user.email", "ops@test")
    git(other, "config", "user.name", "ops")
    (other / "README").write_text("two\n", encoding="utf-8")
    git(other, "add", "README")
    git(other, "commit", "-m", "ahead")
    git(other, "push", "origin", "main")


class TestParseDf:
    def test_hits_99_on_listed_mount(self):
        text = (
            "Filesystem 1024-blocks Used Available Capacity Mounted on\n"
            "/dev/md1 8388608 8300000 100000 99% /mnt/user\n"
            "/dev/loop 1024 10 1014 1% /var/lib/docker\n"
        )
        assert host.parse_df_over_threshold(text) == [("/mnt/user", 99)]

    def test_ignores_unlisted_mounts(self):
        text = (
            "Filesystem 1024-blocks Used Available Capacity Mounted on\n"
            "/dev/sdx 100 99 1 99% /mnt/disk1\n"
        )
        assert host.parse_df_over_threshold(text) == []

    def test_80_is_ok(self):
        text = (
            "Filesystem 1024-blocks Used Available Capacity Mounted on\n"
            "/dev/md1 100 80 20 80% /mnt/user\n"
        )
        assert host.parse_df_over_threshold(text) == []


class TestClassify:
    def test_crlf_is_noise(self, tmp_path: Path):
        _origin, nas = init_pair(tmp_path)
        (nas / "README").write_bytes(b"one\r\n")
        noise, real = host.classify_tracked_diffs(nas)
        assert "README" in noise
        assert real == []

    def test_content_change_is_real(self, tmp_path: Path):
        _origin, nas = init_pair(tmp_path)
        (nas / "README").write_text("changed\n", encoding="utf-8")
        noise, real = host.classify_tracked_diffs(nas)
        assert noise == []
        assert real == ["README"]

    def test_tracked_env_is_never_noise(self, tmp_path: Path):
        _origin, nas = init_pair(tmp_path)
        (nas / ".env").write_text("SECRET=1\n", encoding="utf-8")
        git(nas, "add", "-f", ".env")
        git(nas, "commit", "-m", "env")
        (nas / ".env").write_bytes(b"SECRET=1\r\n")
        noise, real = host.classify_tracked_diffs(nas)
        assert ".env" in real
        assert ".env" not in noise

    def test_missing_tracked_file_is_noise(self, tmp_path: Path):
        _origin, nas = init_pair(tmp_path)
        (nas / "README").unlink()
        noise, real = host.classify_tracked_diffs(nas)
        assert "README" in noise
        assert real == []


class TestDiscover:
    def test_cloud_workspace_is_not_live(self):
        assert host.discover_live_repo() is None

    def test_git_argv_sets_safe_directory(self, tmp_path: Path):
        argv = host.git_argv(tmp_path)
        assert argv[:4] == ["git", "-c", f"safe.directory={tmp_path}", "-C"]
        assert argv[4] == str(tmp_path)


class TestIndexLock:
    def test_stale_lock_removed(self, tmp_path: Path):
        _origin, nas = init_pair(tmp_path)
        lock = host.index_lock_path(nas)
        lock.write_text("stale", encoding="utf-8")
        past = time.time() - 400
        os.utime(lock, (past, past))
        msg = host.clear_stale_index_lock(nas)
        assert "removed" in msg
        assert not lock.exists()

    def test_fresh_lock_refuses(self, tmp_path: Path):
        _origin, nas = init_pair(tmp_path)
        lock = host.index_lock_path(nas)
        lock.write_text("live", encoding="utf-8")
        with pytest.raises(RuntimeError, match="git may still be running"):
            host.clear_stale_index_lock(nas)
        assert lock.exists()


class TestSync:
    def test_fast_forward_when_origin_ahead(self, tmp_path: Path):
        origin, nas = init_pair(tmp_path)
        origin_ahead(origin, tmp_path)
        sync.sync_checkout(nas)
        assert git(nas, "rev-parse", "HEAD").stdout == git(nas, "rev-parse", "origin/main").stdout
        assert (nas / "README").read_text(encoding="utf-8") == "two\n"

    def test_restores_crlf_then_fast_forwards(self, tmp_path: Path):
        origin, nas = init_pair(tmp_path)
        (nas / "README").write_bytes(b"one\r\n")
        origin_ahead(origin, tmp_path)
        sync.sync_checkout(nas)
        assert (nas / "README").read_text(encoding="utf-8") == "two\n"

    def test_refuses_real_local_edits(self, tmp_path: Path):
        _origin, nas = init_pair(tmp_path)
        (nas / "README").write_text("local\n", encoding="utf-8")
        with pytest.raises(RuntimeError, match="real diffs"):
            sync.sync_checkout(nas)
        assert (nas / "README").read_text(encoding="utf-8") == "local\n"

    def test_restores_deleted_tracked_file_then_fast_forwards(self, tmp_path: Path):
        origin, nas = init_pair(tmp_path)
        (nas / "README").unlink()
        origin_ahead(origin, tmp_path)
        sync.sync_checkout(nas)
        assert (nas / "README").read_text(encoding="utf-8") == "two\n"

    def test_leaves_untracked_env(self, tmp_path: Path):
        origin, nas = init_pair(tmp_path)
        (nas / ".env").write_text("SECRET=keep\n", encoding="utf-8")
        origin_ahead(origin, tmp_path)
        sync.sync_checkout(nas)
        assert (nas / ".env").read_text(encoding="utf-8") == "SECRET=keep\n"

    def test_refuses_diverged_main(self, tmp_path: Path):
        origin, nas = init_pair(tmp_path)
        (nas / "README").write_text("local-commit\n", encoding="utf-8")
        git(nas, "add", "README")
        git(nas, "commit", "-m", "local")
        origin_ahead(origin, tmp_path)
        with pytest.raises(RuntimeError, match="fast-forward failed"):
            sync.sync_checkout(nas)

    def test_dry_run_does_not_fetch(self, tmp_path: Path):
        origin, nas = init_pair(tmp_path)
        origin_ahead(origin, tmp_path)
        before = git(nas, "rev-parse", "HEAD").stdout.strip()
        sync.sync_checkout(nas, dry_run=True)
        after = git(nas, "rev-parse", "HEAD").stdout.strip()
        assert after == before

    def test_main_without_live_repo_prints_paste(self, capsys: pytest.CaptureFixture[str]):
        code = sync.main([])
        captured = capsys.readouterr()
        assert code == 2
        assert "RFC1918" in captured.out
        assert "--ff-only" in captured.out
        assert "safe.directory" in captured.out

    def test_main_repo_flag_syncs(self, tmp_path: Path):
        origin, nas = init_pair(tmp_path)
        origin_ahead(origin, tmp_path)
        assert sync.main(["--repo", str(nas)]) == 0
        assert (nas / "README").read_text(encoding="utf-8") == "two\n"


class TestOperatorPasteAndShipPaths:
    def test_paste_never_runs_reset_hard(self):
        commands = [
            line.strip()
            for line in sync.OPERATOR_PASTE.splitlines()
            if line.strip() and not line.strip().startswith("#")
        ]
        assert not any("reset --hard" in line for line in commands)

    def test_ship_scripts_pipe_ops_theme_reset(self):
        for name in ("unraid_ship_update_now.py", "unraid_rebuild_and_reset.py"):
            text = (OPS / name).read_text(encoding="utf-8")
            assert "scripts/ops/unraid_reset_themes.py" in text
            assert "scripts/_unraid_reset_themes.py" not in text
