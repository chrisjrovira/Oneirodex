# Cloud vs Unraid — cost ballpark (household)

**Date:** 2026-08-01 · **Status:** First-pass ranges (±50%) · **Seat:** Finance  
**Purpose:** Honest operator expectation for running GameTheca as a **household gaming sphere** — not a SaaS price list.

Detailed assumptions and vendor-rate worksheets stay in the **private vault** (gitignored). This page is scrubbed for public remotes.

---

## Verdict

**Keep the game library on Unraid (or equivalent home NAS).** App + Postgres + optional LiveKit on the LAN is usually tens of dollars per month (power + disk amortization). Hosting multi-TB game binaries in cloud object storage plus internet egress is the cost cliff — often **orders of magnitude** more expensive than home once you leave a small library.

Cloud still makes sense for a **small always-on app/DB** or remote catalog access **while binaries stay home** (hybrid).

---

## What we modeled

| Included | Not included |
|---|---|
| App + Postgres | Product billing / metering |
| Library size bands (TB of owned games) | DRM store download pipelines |
| Optional LiveKit voice | Always-on paid LLM in the app |
| Internet egress (art, installs, remote play) | Class A / shady CDN economics |

Assumed household: roughly **2–8** concurrent members; USD/month; ~**$0.15/kWh** power.

---

## Monthly ranges (ballpark)

### Unraid home (canonical Compose deploy)

| Band | Library size | ≈ $/month |
|---|---|---|
| Low | 1–2 TB | **20–45** |
| Med | 8–20 TB | **40–90** |
| High | 40–80 TB | **70–160** |

Mostly electricity + amortized disks. Self-hosted LiveKit ≈ **$0** incremental.

### Hybrid (cloud app/DB; games stay on Unraid)

| Band | Cloud slice ≈ $/month | Honest total with Unraid kept |
|---|---|---|
| Low | 25–55 | **45–90** |
| Med | 50–120 | **90–200** |
| High | 100–220 | **170–350** |

### Full cloud library (binaries in object storage)

| Band | Library + light–heavy egress | ≈ $/month |
|---|---|---|
| Low | 1–2 TB, rare public installs | **80–200** |
| Med | 8–20 TB + hundreds of GB egress | **250–800** |
| High | 40–80 TB + TB-scale egress | **1,000–3,000+** |

Hyperscaler **hot storage (~tens of $/TB-mo) + egress (~$0.09/GB)** is the usual shock. Cheaper object stores help egress; **TB still scales linearly**.

### LiveKit

| Pattern | Typical cost |
|---|---|
| Household audio on Unraid Compose profile | ≈ **$0** |
| Light Cloud free tier | Often **$0** |
| Heavy Cloud video / egress | Plan fee and/or tens of $/mo |

Prefer **self-hosted LiveKit on the LAN** when UDP/TURN works; see [livekit-unraid.md](../runbooks/livekit-unraid.md).

---

## Biggest cost drivers

1. Game binary **TB in cloud** storage  
2. Public **egress** of installs or always-on remote play  
3. Paying for **cloud and Unraid** at once (hybrid)  
4. Managed HA database (optional luxury for a household)  
5. LiveKit Cloud **video** egress (audio-only is usually small)  
6. Unraid power + disk amortization (still cheapest full-library path)

---

## Operator takeaway

| Goal | Prefer |
|---|---|
| Full owned library + household play | Unraid / Compose ([unraid-deploy](../runbooks/unraid-deploy.md)) |
| Catalog off-LAN; installs at home | Hybrid + VPN or catalog-only remote |
| No home hardware | Accept High cloud bills **or** a tiny library |

Product stance: GameTheca is built for the **home hub**, not as a multi-tenant game CDN.
