#!/usr/bin/env python3
"""Rewrite leftover js/od_*.js paths after files were renamed to od_*.js."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {'.git', '.claude', 'node_modules', 'dist', '__pycache__', 'cores'}
TEXT = {
    '.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.md', '.css', '.json',
    '.yml', '.yaml', '.txt', '.sh', '.example',
}


def main() -> int:
    changed = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.endswith('.egg-info')]
        rel = Path(dirpath).relative_to(ROOT)
        if any(p in rel.parts for p in SKIP_DIRS):
            continue
        if 'vendor' in rel.parts and 'webretro' in rel.parts and 'cores' in rel.parts:
            continue
        for name in filenames:
            path = Path(dirpath) / name
            if path.name.startswith('_p3b_fix_js_paths'):
                continue
            try:
                raw = path.read_text(encoding='utf-8')
            except (UnicodeDecodeError, OSError):
                continue
            new = raw.replace('js/od_', 'js/od_')
            # Bare filenames in tests / ship scripts (not token prefix gt_ab12).
            new = new.replace("od_toast.js", "od_toast.js")
            new = new.replace("od_dom_actions.js", "od_dom_actions.js")
            new = new.replace("od_sortable_table.js", "od_sortable_table.js")
            new = new.replace("od_modal_stack.js", "od_modal_stack.js")
            new = new.replace("od_loading_motifs.js", "od_loading_motifs.js")
            if new == raw:
                continue
            path.write_text(new, encoding='utf-8', newline='\n')
            changed += 1
            print(path.relative_to(ROOT))
    print('changed', changed)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
