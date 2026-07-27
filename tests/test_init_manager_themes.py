"""Boot-time theme setup must not depend on the process working directory."""

import os

import pytest

from gametheca.init_manager import PACKAGE_ROOT, InitializationManager
from gametheca.utils.preset_themes import PRESET_SLUGS, install_preset_themes


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(text)


def read(path):
    with open(path, 'r', encoding='utf-8') as fh:
        return fh.read()


@pytest.fixture
def manager():
    return InitializationManager()


class TestSourcePathResolution:
    def test_source_is_absolute_and_inside_the_package(self, manager):
        source = manager.default_theme_source()

        assert os.path.isabs(source)
        assert source == os.path.join(PACKAGE_ROOT, 'setup', 'default_theme')

    def test_source_resolves_from_any_working_directory(self, manager, tmp_path, monkeypatch):
        """Docker/uvicorn start the app from a CWD that is not the repo root."""
        from_repo_root = manager.default_theme_source()
        monkeypatch.chdir(tmp_path)

        assert manager.default_theme_source() == from_repo_root
        assert os.path.isdir(manager.default_theme_source())

    def test_shipped_source_actually_exists(self, manager):
        source = manager.default_theme_source()

        assert os.path.isfile(os.path.join(source, 'theme.json'))
        assert os.path.isfile(os.path.join(source, 'css', 'gt-tokens.css'))


class TestThemeFileSync:
    def test_changed_file_is_refreshed(self, manager, tmp_path):
        source = tmp_path / 'source'
        target = tmp_path / 'target'
        write(str(source / 'css' / 'admin' / 'admin_ops.css'), '.ops { color: red; }\n')
        write(str(source / 'js' / 'app.js'), 'console.log(1);\n')

        assert manager._sync_theme_files(str(source), str(target)) == 2

        write(str(source / 'css' / 'admin' / 'admin_ops.css'), '.ops { color: blue; }\n')

        assert manager._sync_theme_files(str(source), str(target)) == 1
        assert read(str(target / 'css' / 'admin' / 'admin_ops.css')) == '.ops { color: blue; }\n'

    def test_sync_is_idempotent(self, manager, tmp_path):
        source = tmp_path / 'source'
        target = tmp_path / 'target'
        write(str(source / 'css' / 'base.css'), ':root {}\n')
        manager._sync_theme_files(str(source), str(target))

        assert manager._sync_theme_files(str(source), str(target)) == 0


class TestSetupDefaultTheme:
    def test_presets_are_installed_alongside_the_default_theme(self, manager, tmp_path, monkeypatch):
        themes_path = tmp_path / 'themes'
        monkeypatch.setattr(
            InitializationManager,
            'default_theme_source',
            staticmethod(lambda: os.path.join(PACKAGE_ROOT, 'setup', 'default_theme')),
        )

        manager._setup_default_theme(str(themes_path), dev_mode=False)

        assert (themes_path / 'default' / 'css' / 'gt-tokens.css').is_file()
        for slug in PRESET_SLUGS:
            assert (themes_path / slug / 'css' / 'gt-tokens.css').is_file()

    def test_second_boot_refreshes_a_changed_default_file(self, manager, tmp_path):
        themes_path = tmp_path / 'themes'
        manager._setup_default_theme(str(themes_path), dev_mode=False)
        tampered = themes_path / 'default' / 'css' / 'gt-tokens.css'
        write(str(tampered), '/* wiped */\n')

        manager._setup_default_theme(str(themes_path), dev_mode=False)

        assert '--gt-accent' in read(str(tampered))

    def test_preset_accents_are_distinct_from_the_default(self, manager, tmp_path):
        themes_path = tmp_path / 'themes'
        manager._setup_default_theme(str(themes_path), dev_mode=False)

        accents = set()
        for slug in PRESET_SLUGS:
            tokens = read(str(themes_path / slug / 'css' / 'gt-tokens.css'))
            accents.add(next(
                line.strip() for line in tokens.splitlines()
                if line.strip().startswith('--gt-accent:')
            ))

        assert len(accents) == len(PRESET_SLUGS)
        assert '--gt-accent: #ff5a36;' not in accents

    def test_missing_source_does_not_raise(self, manager, tmp_path, monkeypatch):
        monkeypatch.setattr(
            InitializationManager,
            'default_theme_source',
            staticmethod(lambda: str(tmp_path / 'no_such_source')),
        )

        manager._setup_default_theme(str(tmp_path / 'themes'), dev_mode=False)

        assert not (tmp_path / 'themes' / 'default').exists()


def test_install_preset_themes_uses_the_shipped_source(tmp_path):
    """End-to-end against the real tracked theme, not a fixture."""
    themes_path = tmp_path / 'themes'
    source = os.path.join(PACKAGE_ROOT, 'setup', 'default_theme')

    rebuilt = install_preset_themes(str(themes_path), source)

    assert rebuilt == len(PRESET_SLUGS)
    for slug in PRESET_SLUGS:
        assert (themes_path / slug / 'css' / 'gt-tokens.css').is_file()
