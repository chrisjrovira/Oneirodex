---
name: issue-assess
description: >-
  Triages GameTheca user-reported bugs into severity, likely area, repro gaps,
  and next checks. Use when the user pastes a user report, GitHub issue text, or
  asks to assess or triage a support ticket. Assess only — do not implement
  fixes unless asked.
---

# GameTheca issue assess

Assess only. No code changes unless the user says **fix**.

## Input expected

Symptom · role (admin/user/child) · deploy (Unraid/Compose/native) · browser or client · when it started · exact URL/API if known · screenshots or logs (trimmed).

If critical gaps remain, ask at most 3 questions — then still give a best-effort triage.

## Do

1. Restate the issue in one line.
2. Severity: `P0` ship-block · `P1` major · `P2` polish · `P3` wishlist.
3. Area guess (1–2): auth · library/scan · download · webretro · companion · acquire/arr · social · themes/icons · admin · oidc · security.
4. Likely cause hypothesis (at most 2 bullets). Cite paths only if already known; otherwise open [map.md](map.md).
5. Repro checklist — minimal steps.
6. Verify commands (pytest slice / curl / docker log) — only the smallest set.
7. Next action: `need-info` | `doc` | `config` | `code` | `ops`.

## Don't

- Rewrite the product vision or open a long roadmap.
- Dump whole files or start a broad refactor.
- Claim a root cause without evidence — mark it `hypothesis`.
- Echo secrets from `.env` or logs into the reply.

## Output (strict)

```
### Triage
**One-liner:** …
**Sev:** P? · **Area:** …
**Hypothesis:** …
**Need from reporter:** (≤3 or "none")
**Repro:** 1. … 2. …
**Check:** `…`
**Next:** need-info | doc | config | code | ops
**Owner hint:** wave or doc if obvious
```

Keep the reply under 25 lines unless the user asks for depth.

Locked defaults: [docs/dev/agent-locks.md](../../../docs/dev/agent-locks.md).
