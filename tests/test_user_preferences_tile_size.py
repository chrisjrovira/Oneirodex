"""tile_size preference: model field, form field, schema migration, settings save."""
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask


def test_user_preference_model_has_tile_size():
    from gametheca.models import UserPreference

    col = UserPreference.__table__.c.tile_size
    assert col is not None
    assert str(col.type).startswith('VARCHAR') or 'String' in type(col.type).__name__
    assert col.default.arg == 'M'


def test_user_preferences_form_includes_tile_size():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'test'
    app.config['WTF_CSRF_ENABLED'] = False

    with app.app_context():
        with patch('gametheca.forms.ThemeManager') as tm:
            tm.return_value.get_installed_themes.return_value = []
            from gametheca.forms import UserPreferencesForm

            form = UserPreferencesForm()
            assert 'tile_size' in form._fields
            assert form.tile_size.choices == [('S', 'S'), ('M', 'M'), ('L', 'L'), ('XL', 'XL')]


def test_updateschema_adds_tile_size_column():
    from pathlib import Path

    text = Path('gametheca/updateschema.py').read_text(encoding='utf-8')
    assert 'ADD COLUMN IF NOT EXISTS tile_size VARCHAR(4) DEFAULT \'M\'' in text


def test_settings_panel_assigns_tile_size():
    """settings_panel must write form.tile_size onto preferences."""
    from pathlib import Path

    src = Path('gametheca/routes_settings.py').read_text(encoding='utf-8')
    assert 'current_user.preferences.tile_size = form.tile_size.data or \'M\'' in src
