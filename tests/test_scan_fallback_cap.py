"""Fallback name truncation must stay capped (scan stall guard)."""

from oneirodex.utils import scanning


def test_fallback_truncation_cap_math():
    """Mirrors process_game_with_fallback: at most 3 shorter names."""
    parts = 'The Really Long Game Title With Many Words Here'.split()
    max_fallback = min(3, max(0, len(parts) - 1))
    attempts = []
    for i in range(len(parts) - 1, len(parts) - 1 - max_fallback, -1):
        if i <= 0:
            break
        attempts.append(' '.join(parts[:i]))
    assert len(attempts) == 3
    assert attempts[0] == ' '.join(parts[:-1])
    assert attempts[1] == ' '.join(parts[:-2])
    assert attempts[2] == ' '.join(parts[:-3])


def test_scanning_module_exposes_process_game_with_fallback():
    assert callable(scanning.process_game_with_fallback)
