# Support inbox (admins)

Teammate reports land in-app and optionally on GitHub. Discord is not used.

## Member path

Members open **More → Report issue** (`/report`). Fields: title, symptom, area, severity, deploy, client, URL, logs.

## Admin path

1. Open **`/admin/support`** (Users hub → Support inbox), or follow the in-app notification.
2. Review severity / area / GitHub link.
3. Mark **Resolve** when done.
4. Triage in Cursor with `@issue-assess`, implement with `@issue-fix` — [issue-assess-agent.md](../dev/issue-assess-agent.md).

## Env

| Variable | Purpose |
|---|---|
| `SUPPORT_GITHUB_TOKEN` | PAT with `issues:write`. If unset, ticket still saves; `github_sync=skipped`. |
| `SUPPORT_GITHUB_REPO` | Default `chrisjrovira/gametheca` |

## Admin alert prefs

Global settings: `admin_notify_support` (and related `admin_notify_*` for library events). User preference `notify_support` controls whether admins receive in-app rows.

## API

- `POST /api/support/tickets` — create (session + CSRF)
- `GET /api/support/tickets` — own tickets (members) / all (admin)
- `POST /api/support/tickets/<id>/resolve` — admin
