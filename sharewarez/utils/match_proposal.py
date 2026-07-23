"""Build and optionally persist low-confidence match proposals (sidecar JSON)."""

import json
import os
from datetime import datetime, timezone

from sharewarez.utils.match_scoring import rank_candidates
from sharewarez.utils.game_name_parse import parse_game_label


PROPOSAL_FILENAME = 'sharewarez.proposal.json'


def build_match_proposal(
    raw_label: str,
    candidates: list[dict],
    *,
    steam_title: str | None = None,
    confidence: str = 'low',
) -> dict:
    """Create a proposal payload from a folder label and IGDB candidate list.

    `confidence` defaults to 'low' (the normal ambiguous-match case) but callers
    such as the propose-only scan mode pass 'high' when a confident match was
    found but auto-import was skipped by policy.
    """
    parsed = parse_game_label(raw_label)
    cleaned = parsed['cleaned_name'] or raw_label
    ranked = rank_candidates(cleaned, candidates, steam_title=steam_title)
    return {
        'proposal': {
            'cleaned_name': cleaned,
            'steam_app_id': parsed.get('steam_app_id'),
            'candidates': [
                {
                    'igdb_id': c.get('id'),
                    'name': c.get('name'),
                    'score': round(float(c.get('match_score') or 0), 4),
                }
                for c in ranked[:10]
            ],
            'confidence': confidence,
            'proposed_at': datetime.now(timezone.utc).isoformat(),
        }
    }


def write_match_proposal(folder_path: str, proposal: dict, filename: str = PROPOSAL_FILENAME) -> bool:
    """Write proposal JSON into a game folder. Returns True on success."""
    if not folder_path or not os.path.isdir(folder_path):
        return False
    if not isinstance(proposal, dict) or 'proposal' not in proposal:
        return False
    target = os.path.join(folder_path, filename)
    try:
        with open(target, 'w', encoding='utf-8') as handle:
            json.dump(proposal, handle, indent=2, ensure_ascii=False)
        return True
    except OSError:
        return False
