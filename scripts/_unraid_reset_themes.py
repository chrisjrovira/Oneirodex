"""Reset default + preset themes inside oneirodex-app. Run via docker exec -i python -."""
from pathlib import Path
import shutil

from oneirodex.utils.preset_themes import install_preset_themes

app_root = Path('/app/oneirodex')
src = app_root / 'setup' / 'default_theme'
dst = app_root / 'static' / 'library' / 'themes' / 'default'
assert src.is_dir(), src
if dst.exists():
    shutil.rmtree(dst)
dst.parent.mkdir(parents=True, exist_ok=True)
shutil.copytree(src, dst)
n = install_preset_themes(str(dst.parent), str(src), force=True)
print(f'reset default theme + {n} presets')
