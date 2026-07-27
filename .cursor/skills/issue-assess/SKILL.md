---
name: issue-assess
description: >-
  Triages GameTheca user-reported bugs into severity, likely area, repro gaps,
  and next checks. Use when a teammate pastes a user report, GitHub issue text,
  or asks to assess/triage a support ticket. Do not implement fixes unless asked.
disable-model-invocation: true
---

# GameTheca issue assess

Assess only. No code changes unless the human says **fix**.

## Input expect

Paste: symptom · role (admin/user/child) · deploy (Unraid/Compose/native) · browser/client · when started · exact URL/API if known · screenshots/logs (trim).

If critical gaps: ask ≤3 questions, then still give a best-effort triage.

## Do

1. Restate issue in 1 line.
2. Severity: `P0` ship-block · `P1` major · `P2` polish · `P3` wishlist.
3. Area guess (1–2): auth · library/scan · download · webretro · companion · acquire/arr · social · themes/icons · admin · oidc · security.
4. Likely cause hypothesis (≤2 bullets). Cite paths only if already known; else open [map.md](map.md).
5. Repro checklist (minimal steps).
6. Verify cmds (pytest slice / curl / docker log) — only the smallest set.
7. Next action: `need-info` | `doc` | `config` | `code` | `ops`.

## Don't

- Rewrite the product vision or open long roadmaps.
- Dump whole files or run broad refactors.
- Claim root cause without evidence; mark `hypothesis`.
- Expose secrets from `.env` / logs in the reply.

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
**Owner hint:** wave/doc if obvious (sec / W12–18 / themes)
```

Keep reply ≤25 lines unless human asks for depth.
