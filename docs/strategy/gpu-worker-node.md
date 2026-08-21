# GPU worker node — put the GPU anywhere, keep the server GPU-less

**Date:** 2026-08-21  
**Status:** Nice-to-have · post-1.0 backlog (**not started**)  
**Priority:** backlog / sprint nice-to-have  
**Audience:** PM · Backend · Ops · Desktop · QA · Docs  
**Shipped path today:** `AI_ARTWORK_URL` → any A1111-compatible endpoint (`gametheca/utils/ai_artwork.py`) · Compose profile `artwork` (CPU) · GPU reservation opt-in via `docker-compose.gpu.yml`  
**Related:** [cover-art-studio.md](cover-art-studio.md) · [thin-client.md](thin-client.md) · [native-challenge-solver.md](native-challenge-solver.md) · [pm-miss-backlog.md](pm-miss-backlog.md) · `gametheca/routes_apis/client.py`

---

## Problem

The reference deployment is Unraid on a NAS-class box with **no discrete GPU**, and that is not an accident of one household — it is what a self-hosted media/library server usually is. Meanwhile the GPU that could do the work is almost always in the house already, sitting in the gaming PC.

Today the two are wired together by nothing but a URL:

```text
  ENABLE_AI_ARTWORK=true
  AI_ARTWORK_URL=http://<gpu-host>:7860
            │
            ▼
  A1111Generator  →  POST /sdapi/v1/txt2img  →  SD.Next on the GPU box
```

That already works, LAN-wide, with no code changes — `ai_artwork.py` only ever makes an HTTP call and does not care what is on the other end. **This epic is not about making remote GPUs possible.** It is about the gap between "possible" and "an operator will actually keep it running":

| Friction | Why it bites |
|---|---|
| The GPU box is a *desktop* | It sleeps, reboots into a game, moves to a new DHCP lease. The server dials **in**, so any of those is a dead endpoint and a silent feature. |
| No auth on the far end | A1111/SD.Next expose `/sdapi/v1/*` unauthenticated. "Point at your own endpoint" is fine on a trusted VLAN and is not something to productise as-is. |
| Blocking call | `generate_cover_bytes` is a synchronous POST with a 120s timeout. A batch of covers serialises and holds a request worker per image (`UVICORN_WORKERS=1` by default). |
| Setup is the real cost | Drivers + Python + SD.Next + a checkpoint on a Windows gaming PC is the actual barrier, not the URL field. |
| GPU contention | The box's day job is playing games. Nothing today pauses generation while a game is running. |
| Ops can't see it | No health, no VRAM, no queue depth. When art stops appearing there is nothing to look at. |

**Product intent:** a small **worker node** — one installable process on whatever machine has the accelerator — that registers *outbound* to GameTheca, pulls render jobs, runs them against a local generator, and reports health. The server stays GPU-less and unchanged in its deployment shape; where the GPU lives becomes an operational detail rather than a topology decision.

This does **not** gate 1.0 and does not remove the plain-URL path.

---

## Why this is not a bespoke fix

Framed as "connect my Unraid to my PC" this is one household's cable. Framed as a node it is the same object for every shape people actually have:

| Setup | What the node runs on |
|---|---|
| NAS server + gaming PC (the common case) | Windows PC, as a background service |
| Server with a card in it | The Unraid box itself — node in a container, `docker-compose.gpu.yml` |
| Apple silicon desktop in the house | macOS, MPS backend |
| Rented GPU box / colo | Same node, reachable over the operator's own tunnel |
| No GPU anywhere | No node; CPU sidecar or the feature stays off |

The unit of configuration becomes "a node is paired" rather than "an IP is typed in", which is also the only version of this that can survive DHCP, sleep, and a second GPU box being added later.

---

## Recommended shape

Reuse the transport that already exists. `routes_apis/client.py` ships an outbound-poll command queue with `claim_pending_commands` / ack / nack, gated on a companion API token and scope. That is precisely the NAT-friendly pattern a worker needs, and it is proven in the desktop companion.

```text
   Admin / scan  ──enqueue──▶  render job queue     (server, GPU-less)
                                     │
                                     │  outbound poll + claim  (node dials out;
                                     ▼                          no inbound port,
                              GPU worker node                   no port-forward)
                                     │
                                     ▼
                       local A1111 / SD.Next / ComfyUI
                                     │
                                     ▼
                        upload bytes ──▶ stored, labelled generated
```

Two candidate homes for the node, and the choice is the first real decision:

| Option | For | Against |
|---|---|---|
| **Extend `clients/desktop`** (Tauri) | Already installed on the gaming PC, already has keyring pairing, API tokens, heartbeat, lifecycle store — most of GPU-N2 is done | Couples a headless server role to a GUI companion; a headless GPU box does not want a window |
| **New standalone node process** | Headless, containerisable, runs on a box with no desktop session | Re-implements pairing/token/heartbeat that the companion already solved |

Current lean: **share the pairing and heartbeat code, ship the node headless**, and let the companion optionally host it — decided in GPU-N1, not assumed here.

---

## In scope

1. Job contract: render request → bytes, with claim/ack/nack semantics and a retry that cannot lose or duplicate covers
2. Node pairing: an operator-visible token, scoped to render work only, revocable from Admin
3. Node runtime: poll, run against a local generator, upload result, report GPU/VRAM/queue health
4. Backend cutover: `generate_and_store_cover` gains an async/queued path; the direct URL call stays for the simple case
5. Ops visibility: nodes and their state in Admin → Ops, alongside the existing services pulse
6. Idle etiquette: pause or throttle while the host is under load (a game is running)

### Not in this slice

*Scope note: **not in this slice**, not refused.*

- A hosted/multi-tenant render service, or anything that sends prompts off the operator's network
- Generic remote compute — this is artwork jobs, not an arbitrary job runner
- Replacing the plain `AI_ARTWORK_URL` path; it stays the zero-setup option forever
- Model management / checkpoint distribution (operator-supplied, same stance as BIOS and fonts)
- GPU passthrough advice for Unraid VMs — an Unraid concern, documented not owned
- Non-artwork GPU work (upscaling, transcode, local LLM) until the artwork case is proven

---

## Capability matrix / phases

| Capability | GPU-N1 | GPU-N2 | GPU-N3 | GPU-N4 | GPU-N5 |
|---|---|---|---|---|---|
| Job contract + queue schema, contract-tested | ✓ | ✓ | ✓ | ✓ | ✓ |
| Node pairing / scoped token / revoke | | ✓ | ✓ | ✓ | ✓ |
| Headless node polls, renders, uploads | | | ✓ | ✓ | ✓ |
| Ops node health (VRAM, queue depth, last seen) | | | | ✓ | ✓ |
| Installer + idle etiquette + runbook | | | | | ✓ |

### Phase detail

| ID | Outcome | Owner seats | Exit criteria |
|---|---|---|---|
| **GPU-N1** | Render job contract + node-vs-companion decision recorded | PM · Backend · Desktop | ADR picks the node's home; queue schema and claim/ack/nack semantics fixed; pytest covers duplicate-claim and lost-node retry; no client shipped |
| **GPU-N2** | Pairing: scoped render token, issued and revocable in Admin | Backend · Ops | Token cannot reach library/download scopes; revoke kills an in-flight node within one poll; envelope + `error_code` per `api_response.py` |
| **GPU-N3** | Headless node: poll → local generator → upload | Backend · Desktop · QA | Cover generated end-to-end with the server having no GPU and no inbound port open; failure leaves existing artwork untouched (today's rule holds) |
| **GPU-N4** | Node health surfaced in Admin → Ops | Ops · UI · QA | Offline node is visibly offline, not silently absent; honest when no node is paired |
| **GPU-N5** | Installer, idle etiquette, runbook, docs | Ops · Docs · QA | One-file install on Windows; generation yields while a game runs; runbook covers pair, revoke, and "art stopped appearing" |

**UI:** Admin → Ops node panel (GPU-N4) and the pairing screen (GPU-N2). No member SPA work — members never see a node.

---

## Ops / privacy frame

| Rule | Stance |
|---|---|
| LAN-first | Node dials out to GameTheca; nothing listens on a public port by default |
| Prompt content | Unchanged from `build_prompt` — catalogue facts only, never paths, users, or library layout |
| Token blast radius | Render scope only; a stolen node token must not read the library |
| Nothing leaves the network | A node the operator runs, on hardware they own — same stance as the challenge solver |
| Honest when absent | No paired node and no URL = feature reports off, not "generating" |

---

## Risks

| Risk | Mitigation |
|---|---|
| Reinventing the companion's pairing badly | GPU-N1 decides reuse-vs-new before any client code exists |
| Queue outlives the node (jobs stuck claimed) | Lease + nack-on-expiry, exercised in GPU-N1 tests |
| Scope drift into "generic GPU job runner" | Artwork jobs only until GPU-N5 ships and is used |
| Second app to install, support, and sign | Prefer extending the companion; desktop code signing stays out of scope ([desktop-code-signing.md](../runbooks/desktop-code-signing.md)) |
| Feature looks broken when the PC sleeps | GPU-N4 exists precisely so "node offline" is a visible state |

---

## Definition of done (epic)

- [ ] GPU-N1…GPU-N5 complete or explicitly deferred with an ADR
- [ ] Server with no GPU generates artwork against a node, with no inbound port opened
- [ ] Plain `AI_ARTWORK_URL` still works untouched for operators who want the simple path
- [ ] Node token cannot reach library or download scopes; revoke is immediate
- [ ] Ops shows node presence and health honestly, including "no node paired"
- [ ] Docs: runbook + settings-modules + `.env.example` alignment; no 1.0 gate claims

---
