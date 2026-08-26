# Competitive re-score template

**Date:** 2026-08-26  
**Status:** Have — fill a dated copy in `docs/_private/peer-notes/`, never commit named scores  
**Policy:** [external-facing-scrub.md](external-facing-scrub.md)

Use this rubric when the landscape moves (new major release of a peer, or a GameTheca wave that closes an INSP ticket). Named scores stay in the private vault. This file is the empty sheet.

## Lanes (score 0–3)

0 = absent · 1 = stub · 2 = usable · 3 = household-grade

| Lane | Question |
|---|---|
| 1 Library & scan | Can an Unraid operator point at mixed trees and get honest matches without auto-poisoning IDs? |
| 2 Metadata & artwork | Multi-source cascade + local art + identify workbench? |
| 3 Play / emulation | Browser / companion / catalog honesty? Saves? Achievements? |
| 4 Clients & remote | Desktop + thin + handheld + remote-play CTA? |
| 5 Social & presence | Household chat/presence without a third-party chat product? |
| 6 Acquire & requests | BYO indexers + wishlist, not a marketplace? |
| 7 Admin / ops | Unraid/Compose, RBAC/child, Ops, OIDC opt-in? |
| 8 Atmosphere | Lighting, mods, household servers, 10-foot UI? |

## Fit filters (yes/no)

| Filter | Fail means |
|---|---|
| Household, not SaaS | Cloud-only with no self-host path |
| Owned-content honest | Requires DRM circumvention or a pirate storefront |
| Unraid-plausible | Needs k8s or a dedicated appliance OS to work at all |
| No Discord-as-product | The social layer *is* Discord |
| License / ToS | We cannot call the API from a self-hosted app |

A “no” on any filter → **watch** or **ignore**, not adopt.

## Sheet (copy to private notes)

```text
Date:
Scorer:
Peer (private name):
Lane scores: L1 _ L2 _ L3 _ L4 _ L5 _ L6 _ L7 _ L8 _   / 24
Fit filters: household _ owned _ unraid _ no-discord _ license _
Verdict: adopt | watch | ignore | already
INSP tickets this peer feeds:
One-line steal (capability language only):
```

After scoring, update [capability-inspiration.md](capability-inspiration.md) if a ticket should move P1↔P3. Do not add peer names to that file.
