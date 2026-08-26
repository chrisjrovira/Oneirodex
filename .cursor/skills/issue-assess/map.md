# Area → start here (read on demand)

Paths are relative to the repo root.

| Area | Start |
|---|---|
| auth / roles | `gametheca/utils/auth.py` · `gametheca/utils/rbac.py` · `gametheca/utils/oidc.py` |
| library / scan | `gametheca/utils/game_core.py` · scan routes · `gametheca/utils/library_acl.py` |
| download / zip | `gametheca/routes_downloads_ext/` · path `is_safe_path` |
| webretro / play | `gametheca/platform.py` · `gametheca/utils/play_url.py` · `gametheca/static/vendor/webretro/` |
| companion | `gametheca/routes_apis/client.py` · `clients/desktop/` |
| acquire / arr | `gametheca/utils/arr_connectors.py` · `gametheca/routes_apis/acquire.py` · `ALLOW_PRIVATE_LAN_URLS` |
| social / activity | `gametheca/routes_apis/social.py` · `gametheca/utils/presence.py` · `gametheca/utils/activity_feed.py` |
| themes / icons | `gametheca/setup/default_theme/` · `gametheca/utils/icon_themes.py` · prefs modal |
| admin | `gametheca/routes_admin_ext/` · templates `admin/` |
| API envelope | `gametheca/utils/api_response.py` · `scripts/api_envelope_lint.py` |
| security | `docs/strategy/security.md` · `gametheca/utils/security.py` · `tests/test_security_suite.py` |
| triage log | `docs/strategy/bug-triage.md` |
| local pytest DB | `docs/runbooks/local-postgres-pytest.md` · `TEST_DATABASE_URL` |

Known non-goals: third-party chat webhooks · bundled indexers · DRM store download/install queues · public marketplace.
