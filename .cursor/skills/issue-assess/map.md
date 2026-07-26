# Area → start here (read on demand)

| Area | Start |
|---|---|
| auth / roles | `gametheca/utils/auth.py` · `utils/rbac.py` · `utils/oidc.py` |
| library / scan | `utils/game_core.py` · scan routes · `library_acl.py` |
| download / zip | `routes_downloads_ext/` · path `is_safe_path` |
| webretro / play | `platform.py` · `utils/play_url.py` · `static/vendor/webretro/` |
| companion | `routes_apis/client.py` · `clients/desktop/` |
| acquire / arr | `utils/arr_connectors.py` · `routes_apis/acquire.py` · `ALLOW_PRIVATE_LAN_URLS` |
| social / activity | `routes_apis/social.py` · `utils/presence.py` · `utils/activity_feed.py` |
| themes / icons | `setup/default_theme/` · `utils/icon_themes.py` · prefs modal |
| admin | `routes_admin_ext/` · templates `admin/` |
| security | `docs/strategy/security.md` · `utils/security.py` · `tests/test_security_suite.py` |
| triage log | `docs/strategy/bug-triage.md` |
| local pytest DB | `docs/runbooks/local-postgres-pytest.md` · `TEST_DATABASE_URL` → `gamethecatest` |

Known non-goals: Discord clone · bundled indexers · DRM store clients · public marketplace.
