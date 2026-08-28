# SD.Next on a Windows GPU box — not the NAS, not the full stack

The Unraid/NAS Compose file **never** requests a GPU. Art generation wants one. This household’s accelerator is an **RTX 2080 on the Windows workstation** (the machine that also runs Cursor). Do **not** `compose up` the Oneirodex app/db stack on that PC just to draw covers.

Use the sidecar file at the repo root:

```text
docker-compose.artwork-local.yml
```

It starts **only** SD.Next, with an NVIDIA reservation, on port **7860**.

## Before you enable it

```bash
docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi
```

If that fails, Docker Desktop does not see the 2080. Fix the NVIDIA Container Toolkit / WSL2 GPU path first. A reservation on a host with no loaded driver hard-fails container create (`nvml error: driver not loaded`).

Do **not** add `docker-compose.gpu.yml` to the Unraid `.env` `COMPOSE_FILE`. That overlay is for when the *Docker host that runs the app* has the card. The NAS does not.

## Start (GPU PC only)

From this checkout, on the Windows box:

```powershell
docker compose -f docker-compose.artwork-local.yml up -d
```

UI: http://127.0.0.1:7860

The first pull of `saladtechnologies/sdnext` is large. Models live in the `sdnext_models` volume.

## Point the NAS app at this PC

On the Unraid/NAS `.env` (the running Oneirodex stack):

```text
ENABLE_AI_ARTWORK=true
AI_ARTWORK_ENGINE=a1111
AI_ARTWORK_URL=http://<this-pc-lan-ip>:7860
```

Do **not** start `--profile artwork` on the NAS. That profile is the CPU sidecar on the same Compose project; you already have a generator on the LAN.

The backend only POSTs `/sdapi/v1/txt2img`. Nothing leaves the network.

## Icon packs vs Art Studio

| What | Where |
|---|---|
| Rail / Preferences **glyphs** | SVG under `gametheca/setup/icon_themes/{pack}/icons/` — `currentColor`, not photos |
| Pack **preview** rasters | `preview.png` in each pack (art-direction samples; chips still use SVG) |
| Game **covers** | Art Studio → this SD.Next URL |

README live screenshots stay captured from a populated instance. Do not invent them with an image generator.

## Stop

```powershell
docker compose -f docker-compose.artwork-local.yml down
```

Related: [gpu-worker-node.md](../strategy/gpu-worker-node.md) (outbound pairing is still backlog). [docker-compose-deploy.md](docker-compose-deploy.md) § Generated cover art. [container-wont-start.md](container-wont-start.md) § 7.
