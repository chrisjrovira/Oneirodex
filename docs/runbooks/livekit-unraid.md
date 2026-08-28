# LiveKit on Unraid / Compose (Wave 16)

Optional household voice. Oneirodex mints short-lived JWTs; the browser talks to the LiveKit SFU.

## Compose profile

```bash
# From repo root (keys must match Oneirodex env)
export ENABLE_LIVEKIT=true
export LIVEKIT_URL=ws://127.0.0.1:7880   # or wss://livekit.lan behind TLS
export LIVEKIT_API_KEY=devkey
export LIVEKIT_API_SECRET=secret

docker compose --profile livekit up -d livekit
docker compose up -d app
```

`--dev` LiveKit defaults to API key `devkey` / secret `secret`. Change both together before any internet exposure.

## Unraid notes

1. Publish TCP **7880** (HTTP/WS signaling) and UDP **7881–7882** (or the range LiveKit logs) on the LAN.
2. Set `LIVEKIT_URL` to a hostname the **browser** can reach (not `localhost` inside the app container unless members browse from the same host).
3. Behind CGNAT or strict NAT, enable LiveKit embedded TURN or add Coturn; see [social-and-voice.md](../user/social-and-voice.md).
4. TLS: terminate with SWAG/NPM/`wss://` — browsers block insecure WS on HTTPS sites.

## Smoke test

1. Admin → Plugins → `rtc.livekit` should show **configured** when env is set.
2. Member → Activity → Voice lobby → **Get voice token** (must return room + url).
3. Optional: connect with [LiveKit Meet](https://meet.livekit.io/) custom URL + pasted token.

## Parental policy

Child accounts can join audio rooms. `POST /api/rtc/token` with `video` or `screenshare` true returns **403** for role `child`.

## Party rooms (opaque)

Prefer `household:party:<game_uuid>` — never put game titles in the SFU room name.
