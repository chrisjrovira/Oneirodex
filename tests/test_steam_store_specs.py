"""Steam requirement HTML and language-string parsing — no store prices."""

from gametheca.utils.steam_store_specs import (
    merge_store_specs,
    parse_supported_languages,
    public_store_specs,
    store_specs_from_steam_details,
    strip_steam_html,
)


def test_strip_steam_html_drops_markup():
    raw = '<strong>Minimum:</strong><br><ul class="bb_ul"><li>OS: Windows 10</li></ul>'
    text = strip_steam_html(raw)
    assert 'Minimum:' in text
    assert 'Windows 10' in text
    assert '<' not in text


def test_parse_languages_stars_mean_full_audio():
    raw = (
        'English<strong>*</strong>, French, German, Spanish - Spain'
        '<br><strong>*</strong>languages with full audio support'
    )
    rows = parse_supported_languages(raw)
    by_name = {row['name']: row for row in rows}
    assert by_name['English']['audio'] is True
    assert by_name['French']['audio'] is False
    assert by_name['Spanish - Spain']['interface'] is True
    assert by_name['Spanish - Spain']['subtitles'] is True
    assert all(row['name'] != '*languages with full audio support' for row in rows)


def test_store_specs_from_details_skips_empty():
    assert store_specs_from_steam_details({}) is None
    assert store_specs_from_steam_details({'pc_requirements': {}}) is None


def test_store_specs_from_details_maps_os_and_langs():
    specs = store_specs_from_steam_details({
        'pc_requirements': {'minimum': '<strong>Minimum:</strong> Win 10'},
        'mac_requirements': {'recommended': 'macOS 12'},
        'supported_languages': 'English*, French',
    })
    assert specs['system_requirements']['windows']['minimum']
    assert specs['system_requirements']['mac']['recommended'] == 'macOS 12'
    assert 'linux' not in specs['system_requirements']
    assert specs['languages'][0]['name'] == 'English'
    assert specs['languages'][0]['audio'] is True


def test_merge_fills_missing_side_only():
    existing = {'languages': [{'name': 'English', 'interface': True, 'audio': True, 'subtitles': True}]}
    incoming = {
        'system_requirements': {'windows': {'minimum': 'Win 10'}},
        'languages': [{'name': 'French', 'interface': True, 'audio': False, 'subtitles': True}],
    }
    merged = merge_store_specs(existing, incoming)
    assert merged['system_requirements']['windows']['minimum'] == 'Win 10'
    assert merged['languages'][0]['name'] == 'English'


def test_public_store_specs_strips_unknown_keys():
    raw = {
        'system_requirements': {
            'windows': {'minimum': 'Win 10', 'price': '9.99'},
            'deck': {'minimum': 'nope'},
        },
        'languages': [{'name': 'English', 'interface': 1, 'audio': 0, 'subtitles': 1, 'vote': 99}],
        'sale': True,
    }
    public = public_store_specs(raw)
    assert public['system_requirements']['windows'] == {'minimum': 'Win 10'}
    assert 'deck' not in public['system_requirements']
    assert public['languages'] == [
        {'name': 'English', 'interface': True, 'audio': False, 'subtitles': True},
    ]
    assert 'sale' not in public
