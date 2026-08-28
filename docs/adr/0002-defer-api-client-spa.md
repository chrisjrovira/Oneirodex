# ADR: Defer `@gametheca/api-client` in member SPA

**Date:** 2026-07-27  
**Status:** Accepted — **defer** wiring into member SPA (MISS-UI-4)  
**Owners:** `agent-uiux` · `agent-backend` · `maintainer`

## Context

Package `@gametheca/api-client` exists for typed fetches. Mid-polish 0.2 → 1.0 member SPA still uses direct `fetch` / existing helpers. Forcing a one-path cutover before 1.0 adds merge risk without user-facing gain.

## Decision

**Defer** wiring `@gametheca/api-client` into the member SPA until after official 1.0.0 (or a dedicated post-1.0 API client wave). Keep current fetch paths stable.

## Consequences

| Pros | Cons |
|---|---|
| No mid-polish churn on browse routes | Client package stays underused until adopted |
| Stable payloads for Desktop / existing tests | Two fetch styles until a later cutover |

## Follow-ups (post-1.0)

- Adopt client for one low-risk member path (e.g. support tickets or plugins)
- Align OpenAPI → generated types if the package grows

## Related

- Local strategy notes (MISS-UI-4 / v1 readiness)
