---
name: agent-desktop
description: >-
  GameTheca Desktop Companion agent role. Tauri/TypeScript clients/desktop —
  install/update/uninstall, paths, social window, capabilities. Use when
  @agent-desktop, companion offline UX, client_commands from desktop, or Tauri
  window work is requested.
disable-model-invocation: true
---

# Agent: Desktop Companion

**Scope:** `clients/desktop` (Tauri/TypeScript) — install/update/uninstall, paths, social companion window, tray/capabilities, companion↔server commands.

**Do not** redesign the web member SPA. Coordinate via API/command contracts; if the server must accept a new command, write a **Backend handoff** instead of guessing.

## Priorities

- Reliable local install/update/uninstall + path safety
- Social companion window usable outside main library UI
- Clear online/offline UX; queue or explain blocked actions
- Least-privilege capabilities for new windows
- Tests for path/command edge cases where they exist

## Paths

- `clients/desktop/**`

## Locked out

- Flask model rewrites
- Member SPA CSS redesign
- romhacking.net / Discord webhooks

Honor `.cursor/skills/prompt-brief/defaults.md`.

## End of turn

1. Changes
2. OS caveats (Windows first)
3. Backend/UI handoffs
4. Next desktop ticket
5. **Docs touched:** (user/desktop docs when behavior changes)
