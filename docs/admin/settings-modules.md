# Settings & modules

Admin settings use a **card grid** at `/admin/settings` (whole card → destination; `?section=` redirects). Chrome is `base_admin` top bar — React admin SPA migration is program Wave 3.

## Hub badges

Settings hub shows On/Off (and Storage “Apply off”) for optional modules so you can see state without opening each page.

## Arr

- Env: `ENABLE_ARR_MODULE`, `ENABLE_ARR_HARDLINK_PIPELINE`, plus Prowlarr/Jackett/qBittorrent URLs in `.env`.
- Admin toggle via Arr settings / `PUT /api/arr/module` (env **or** DB enable).
- Keep off unless you bring your own indexers for owned-content automation.

## AI

- Env: `ENABLE_AI_ASSIST`, `ENABLE_AI_AUTO_APPLY`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`.
- Admin AI page: enable + Ollama URL/model (`PUT /api/ai/config`) and Test.
- Ollama-only by default; never required for core library use.

## Storage / hardlinks

- `ENABLE_HARDLINK_HELPERS` and `ALLOW_HARDLINK_APPLY` are **env-only** safety gates (no DB toggle).
- Hub banners explain why Apply is disabled when helpers/apply are off or the games mount is RO.

## Other env toggles

| Flag | Effect |
|---|---|
| `ENABLE_VR_BROWSE` | Member VR catalogue |
| `OIDC_ENABLED` + Admin Integrations | SSO (also see OIDC runbooks) |

Related: [libraries-and-scans.md](libraries-and-scans.md) · [docker-compose-deploy.md](../runbooks/docker-compose-deploy.md) · [oidc-sso.md](../runbooks/oidc-sso.md)
