"""Select best IGDB candidate using confidence scoring (no DB)."""

from sharewarez.utils.match_scoring import select_best_match


def test_select_best_high_confidence():
    candidates = [
        {'id': 1, 'name': 'Other Game'},
        {'id': 2, 'name': "Assassin's Creed Shadows"},
    ]
    best, confidence = select_best_match("Assassin's Creed Shadows", candidates)
    assert confidence == 'high'
    assert best['id'] == 2


def test_select_best_low_when_ambiguous():
    candidates = [
        {'id': 1, 'name': 'Final Fantasy VII'},
        {'id': 2, 'name': 'Final Fantasy VII Remake'},
    ]
    best, confidence = select_best_match('Final Fantasy VII', candidates)
    # Exact title should win clearly over Remake
    assert confidence == 'high'
    assert best['id'] == 1


def test_select_best_returns_none_on_low():
    candidates = [
        {'id': 1, 'name': 'Completely Unrelated Title Alpha'},
        {'id': 2, 'name': 'Another Random Beta Game'},
    ]
    best, confidence = select_best_match('Barony', candidates)
    assert confidence == 'low'
    assert best is None


def test_empty_candidates():
    best, confidence = select_best_match('Anything', [])
    assert best is None
    assert confidence == 'low'
