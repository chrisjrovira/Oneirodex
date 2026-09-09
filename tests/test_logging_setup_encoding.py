"""Console-handler encoding regression for oneirodex/utils/logging_setup.py.

The console handler is a plain ``logging.StreamHandler`` on stdout. On a Windows
console using code page cp1252 a log record carrying non-Latin-1 characters (an
emoji in a warning) raised ``UnicodeEncodeError`` inside the stdlib
``StreamHandler.emit`` — the record was dropped and "--- Logging error ---"
printed to stderr. ``configure_logging`` now forces the underlying stream to
UTF-8 with ``errors="replace"`` after ``dictConfig`` so those records emit.

No database needed.
"""

from __future__ import annotations

import io
import logging

import pytest

from oneirodex.utils import logging_setup as ls


@pytest.fixture(autouse=True)
def _restore_logging():
    """Snapshot and restore root logging so these tests don't leak config."""
    root = logging.getLogger()
    saved_handlers = root.handlers[:]
    saved_level = root.level
    yield
    for h in root.handlers[:]:
        if h not in saved_handlers:
            root.removeHandler(h)
    root.handlers[:] = saved_handlers
    root.setLevel(saved_level)


def _cp1252_stdout() -> tuple[io.TextIOWrapper, io.BytesIO]:
    buf = io.BytesIO()
    stream = io.TextIOWrapper(buf, encoding="cp1252", errors="strict", newline="")
    return stream, buf


def test_emoji_record_does_not_raise_on_a_cp1252_console(monkeypatch):
    stream, buf = _cp1252_stdout()
    monkeypatch.setattr("sys.stdout", stream)
    monkeypatch.setenv("ONEIRODEX_LOG_LEVEL", "INFO")
    monkeypatch.delenv("ONEIRODEX_LOG_JSON", raising=False)

    ls.configure_logging()

    logger = logging.getLogger("oneirodex.test.encoding")
    # A warning to no listener would still exercise emit; this is the live
    # offender's shape (oneirodex/utils/local_metadata.py:409).
    logger.warning("⚠️ test — emoji –   done")

    for h in logging.getLogger().handlers:
        h.flush()
    stream.flush()

    assert buf.getvalue(), "the emoji record produced no output"
    decoded = buf.getvalue().decode("utf-8", errors="replace")
    assert "test" in decoded
    assert "emoji" in decoded


def test_plain_ascii_record_still_logs(monkeypatch):
    stream, buf = _cp1252_stdout()
    monkeypatch.setattr("sys.stdout", stream)
    monkeypatch.setenv("ONEIRODEX_LOG_LEVEL", "INFO")
    monkeypatch.delenv("ONEIRODEX_LOG_JSON", raising=False)

    ls.configure_logging()

    logging.getLogger("oneirodex.test.ascii").warning("plain ascii message")

    for h in logging.getLogger().handlers:
        h.flush()
    stream.flush()

    assert b"plain ascii message" in buf.getvalue()


def test_non_reconfigurable_stream_is_tolerated(monkeypatch):
    """A stream with no ``reconfigure`` (a redirect / capture) must not break setup."""

    class _NoReconfigure:
        def __init__(self) -> None:
            self.chunks: list[str] = []

        def write(self, s: str) -> int:
            self.chunks.append(s)
            return len(s)

        def flush(self) -> None:
            pass

    fake = _NoReconfigure()
    monkeypatch.setattr("sys.stdout", fake)
    monkeypatch.setenv("ONEIRODEX_LOG_LEVEL", "INFO")

    ls.configure_logging()  # must not raise

    logging.getLogger("oneirodex.test.noreconf").warning("hello")
    assert any("hello" in c for c in fake.chunks)
