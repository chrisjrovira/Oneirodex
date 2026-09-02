#!/usr/bin/env python3
"""Merge Unraid product flags + Authentik OIDC into live .env. Does not print secrets."""
from __future__ import annotations

import subprocess
from pathlib import Path

ENV_PATH = Path(r"Z:\_projects\Oneirodex\.env")
SSH = ["ssh", "-o", "BatchMode=yes", "root@192.168.50.116"]
SECRET_REMOTE = "/mnt/user/appdata/authentik/media/.oneirodex_oidc_secret"

UPSERT = {
    "APP_IMAGE": "oneirodex:1.0.0-beta",
    "APP_CONTAINER_NAME": "oneirodex-app",
    "DB_CONTAINER_NAME": "oneirodex-db",
    "COMPOSE_FILE": "docker-compose.yml",
    "ENABLE_ARR_MODULE": "true",
    "ENABLE_ARR_HARDLINK_PIPELINE": "true",
    "ENABLE_AI_ASSIST": "true",
    "ENABLE_AI_AUTO_APPLY": "false",
    "ENABLE_HARDLINK_HELPERS": "true",
    "ALLOW_HARDLINK_APPLY": "false",
    "ENABLE_VR_BROWSE": "true",
    "ENABLE_AI_ARTWORK": "true",
    "ENABLE_LIVEKIT": "true",
    "LIVEKIT_URL": "ws://192.168.50.116:7880",
    "LIVEKIT_API_KEY": "devkey",
    "LIVEKIT_API_SECRET": "secret",
    "ENABLE_MALWARE_SCAN": "true",
    "ENABLE_GAME_ASSISTS": "true",
    "ENABLE_DEBRID": "true",
    "ENABLE_PCDOS_BROWSER": "true",
    "ENABLE_RUFFLE": "true",
    "ENABLE_ROM_PATCH_APPLY": "true",
    "ENABLE_PATCH_CATALOG": "true",
    "ENABLE_ROM_AI_TRANSLATE": "true",
    "ENABLE_MOD_TRACKING": "true",
    "ENABLE_ACTIVITY_FEED": "true",
    "ENABLE_FREE_GAMES": "true",
    "ENABLE_DISCOVER_ML": "true",
    "ENABLE_EMAIL_DIGEST": "true",
    "ENABLE_LOGIN_RATE_LIMIT": "true",
    "ENABLE_REMOTE_PLAY": "true",
    "ENABLE_AMBIENT_LIGHTING": "true",
    "ENABLE_CHALLENGE_SOLVER": "true",
    "CHALLENGE_SOLVER_URL": "http://trawl:8191",
    "OIDC_ENABLED": "true",
    "OIDC_ISSUER_URL": "http://192.168.50.116:9000/application/o/oneirodex/",
    "OIDC_CLIENT_ID": "oneirodex",
    "OIDC_REDIRECT_URI": "http://192.168.50.116:5006/login/oidc/callback",
    "OIDC_SCOPES": "openid email profile groups",
    "OIDC_ROLE_CLAIM": "groups",
    "OIDC_DISPLAY_NAME": "Sign in with SSO",
    "SESSION_COOKIE_SECURE": "false",
    "REMEMBER_COOKIE_SECURE": "false",
    "TRUSTED_PROXIES": "0",
}


def upsert(text: str, key: str, value: str) -> str:
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    found = False
    prefix = f"{key}="
    for line in lines:
        if line.startswith(prefix) or line.startswith(f"#{prefix}"):
            if not found:
                out.append(f"{key}={value}\n")
                found = True
            continue
        out.append(line)
    if not found:
        if out and not out[-1].endswith("\n"):
            out.append("\n")
        out.append(f"{key}={value}\n")
    return "".join(out)


def main() -> int:
    got = subprocess.run(
        SSH + [f"cat {SECRET_REMOTE}"],
        capture_output=True,
        check=True,
    )
    secret = got.stdout.decode().strip()
    if len(secret) < 16:
        raise SystemExit("OIDC secret file missing or too short")
    text = ENV_PATH.read_text(encoding="utf-8")
    for key, value in UPSERT.items():
        text = upsert(text, key, value)
    text = upsert(text, "OIDC_CLIENT_SECRET", secret)
    ENV_PATH.write_text(text, encoding="utf-8", newline="\n")
    keys = [ln.split("=", 1)[0] for ln in text.splitlines() if ln.startswith("ENABLE_") or ln.startswith("OIDC_")]
    print("patched", ENV_PATH.name, "flags", ",".join(keys))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
