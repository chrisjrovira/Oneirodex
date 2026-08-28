"""Live checkout path is Oneirodex, not the retired Gametheca folder name.

Filesystem-only. Package path `gametheca/` and container names stay.
"""

from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
STALE = ('_projects/Gametheca', '_projects\\Gametheca')


def _live_files():
    files = [
        REPO / 'NAS-DEPLOY.md',
        REPO / '.env.unraid.example',
        REPO / '.env.nas.example',
        REPO / '.env.docker.example',
        REPO / '.cursor' / 'rules' / 'compose-unraid.mdc',
        REPO / '.cursor' / 'agents' / 'agent-qa.md',
    ]
    for path in REPO.glob('docker-compose*.yml'):
        files.append(path)
    docs = REPO / 'docs'
    for path in docs.rglob('*'):
        if not path.is_file():
            continue
        if 'archive' in path.parts:
            continue
        files.append(path)
    return files


def test_operator_docs_checkout_is_oneirodex():
    hits = []
    for path in _live_files():
        text = path.read_text(encoding='utf-8', errors='replace')
        if any(needle in text for needle in STALE):
            hits.append(path.relative_to(REPO).as_posix())
    assert hits == [], f'stale Gametheca checkout path in: {hits}'
