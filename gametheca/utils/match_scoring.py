"""Score IGDB name candidates and classify high vs low confidence."""

from difflib import SequenceMatcher
import re

DEFAULT_HIGH_THRESHOLD = 0.92
DEFAULT_AMBIGUOUS_GAP = 0.08


def normalize_for_score(name: str) -> str:
    """Lowercase alphanumeric-only form for similarity comparison."""
    if not name:
        return ''
    return re.sub(r'[^a-z0-9]+', '', name.lower())


def score_candidate(cleaned_name: str, candidate_name: str, *, steam_title: str | None = None) -> float:
    """
    Return similarity score in [0, 1] between cleaned folder name and an IGDB candidate title.

    Optional steam_title: if provided and strongly matches the candidate, bump the score slightly.
    """
    left = normalize_for_score(cleaned_name)
    right = normalize_for_score(candidate_name)
    if not left or not right:
        return 0.0

    score = SequenceMatcher(None, left, right).ratio()

    if steam_title:
        steam_norm = normalize_for_score(steam_title)
        if steam_norm and SequenceMatcher(None, steam_norm, right).ratio() >= 0.92:
            score = min(1.0, score + 0.05)

    return float(score)


def classify_confidence(
    scores: list[float],
    *,
    high_threshold: float = DEFAULT_HIGH_THRESHOLD,
    ambiguous_gap: float = DEFAULT_AMBIGUOUS_GAP,
) -> str:
    """
    Classify match confidence from a sorted-or-unsorted list of candidate scores.

    high: best >= threshold AND (only one score OR best-second >= gap)
    low: otherwise
    """
    if not scores:
        return "low"

    ordered = sorted((float(s) for s in scores), reverse=True)
    best = ordered[0]
    if best < high_threshold:
        return "low"
    if len(ordered) == 1:
        return "high"
    if (best - ordered[1]) >= ambiguous_gap:
        return "high"
    return "low"


def select_best_match(cleaned_name: str, candidates: list[dict], *, steam_title: str | None = None):
    """
    Rank IGDB candidate dicts (must include 'name') and return (best_or_None, confidence).

    On high confidence, best is the winning candidate dict.
    On low confidence, best is None (caller should queue for human review).
    """
    if not candidates:
        return None, "low"

    scored = []
    for candidate in candidates:
        name = candidate.get('name') or ''
        scored.append((score_candidate(cleaned_name, name, steam_title=steam_title), candidate))

    scored.sort(key=lambda item: item[0], reverse=True)
    confidence = classify_confidence([s for s, _ in scored])
    if confidence == "high":
        return scored[0][1], "high"
    return None, "low"


def rank_candidates(cleaned_name: str, candidates: list[dict], *, steam_title: str | None = None) -> list[dict]:
    """Return candidates annotated with 'match_score', best first (for review UI)."""
    ranked = []
    for candidate in candidates:
        entry = dict(candidate)
        entry['match_score'] = score_candidate(
            cleaned_name, candidate.get('name') or '', steam_title=steam_title
        )
        ranked.append(entry)
    ranked.sort(key=lambda c: c['match_score'], reverse=True)
    return ranked
