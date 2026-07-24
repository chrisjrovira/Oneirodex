# Emulator save sync + archive ROM resolution + i18n foundation
# Spec: docs/superpowers/specs/2026-07-24-emu-i18n-design.md

## Emulator saves (opt-in cloud save)
- Model `EmulatorSave`: user_id, game_uuid, slot_name, filename, size_bytes, storage_path, updated_at
- Caps: 2MB per save, 10 slots per user/game
- API: GET/POST/DELETE `/api/games/<uuid>/saves`
- Files under `static/library/saves/<user_id>/<game_uuid>/`

## Archive ROM support
- Utility resolves playable ROM from `.zip` (stdlib) for WebRetro path
- Prefer known ROM extensions inside archive; extract to cache under `static/library/rom_cache/`
- ASGI `/api/downloadrom/` uses resolver when path is zip (or folder with single zip)
- `.7z`/`.rar` listed as unsupported with clear 415 (no new native codecs required for v1)

## i18n
- Flask-Babel with locales `en`, `es`
- UserPreference.locale column + cookie `gt_locale`
- `/settings/locale` POST + language picker in preferences modal if present
- Minimal catalog: nav strings + common buttons via gettext wrappers in a few templates

## Out of scope
ScreenScraper live API, full UI translation, 7z/rar decode, encrypted save blobs
