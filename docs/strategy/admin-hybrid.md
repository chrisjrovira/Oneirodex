# Admin UI hybrid surfaces (supported for 1.0)

**Date:** 2026-07-27  
**Status:** Supported — not a ship blocker  
**Owners:** `@agent-uiux` · `@agent-docs`

## Stance

Official **1.0.0** ships with a **hybrid admin**: React shell (`frontend/admin-app`)
for chrome + selected hubs, and Jinja (`base_admin.html` + templates under
`gametheca/templates/admin/`) for many forms. This is **intentional and supported**,
not an unfinished broken mode.

Progressive migration continues after 1.0 (Wave 3 remainder).

## React-owned (live SPA bodies)

| Route / hub | Notes |
|---|---|
| Admin shell / top nav | `frontend/admin-app` |
| Dashboard | Counts / hub links |
| Ops | `/admin/ops` + `/admin/api/ops/summary` (incl. services pulse) |
| Users roster | `/admin/users` |
| Invites | `/admin/invites` |
| Support inbox | React |
| Announcements | React |
| Scans status (partial) | Live status tiles; start/forms may still Jinja |
| Integrations hub | React **grouped cards** (IGDB · SMTP · OIDC · LiveKit · Support) when Jinja body is empty; deep links preserve classic forms |

## Jinja-backed (expected)

Typical remaining bodies include libraries manage, scan job forms, integrations
detail forms (tabs/forms under `/admin/integrations`, SMTP, IGDB), themes, OIDC
settings fields, recognition/unmatched, newsletter, and other classic `/admin/*`
templates. Operators may see React chrome wrapping a Jinja content region
(`#admin-legacy-content`).

Exact template inventory: `gametheca/templates/admin/` (~40+ files). Do not treat
“still Jinja” as a regression in 1.0 release notes.

## Operator message

> Admin uses a React top bar. Some settings pages still use the classic form UI
> underneath — both are supported. Prefer Admin → Ops for health; Features for
> module toggles.

## Related

- [ui.md](ui.md) Wave 3  
- [v1-readiness.md](v1-readiness.md) gate 6  
- [settings-modules.md](../admin/settings-modules.md)
