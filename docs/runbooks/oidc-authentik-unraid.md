# Authentik + GameTheca on Unraid (OIDC)

End-to-end steps for Unraid: install Authentik, create the GameTheca OAuth app, set `OIDC_*` + `TRUSTED_PROXIES=1`, smoke-test SSO.

Assume:

- GameTheca is already reachable at something like `https://games.example.com` (or a LAN hostname via Swag / NPM / Traefik).
- You will put Authentik at something like `https://auth.example.com`.

Replace hostnames below with yours. Paths must match **exactly**.

---

## 1. Install Authentik on Unraid

1. Unraid → **Apps** → search **Authentik** (official / community template).
2. Install with persistent volumes for Postgres + media (template defaults are fine for a first install).
3. Set a strong `AUTHENTIK_SECRET_KEY` / bootstrap password as the template asks.
4. Put Authentik behind HTTPS (same reverse proxy stack you use for GameTheca):
   - Forward `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`.
5. Open Authentik admin UI and finish first-login setup.
6. Create at least one test user with a real **email** (GameTheca matches existing users by email).

---

## 2. Create the OAuth2/OIDC provider in Authentik

1. Authentik admin → **Applications → Providers → Create** → **OAuth2/OpenID Provider**.
2. Settings:
   - **Name:** `GameTheca`
   - **Authorization flow:** default authentication flow (or your preferred login flow)
   - **Client type:** **Confidential** (recommended)
   - **Redirect URIs:**  
     `https://games.example.com/login/oidc/callback`  
     (your GameTheca public URL + `/login/oidc/callback` — no trailing slash unless you use one everywhere)
   - **Signing key:** Authentik self-signed / default is fine to start
3. Save. Copy **Client ID** and **Client Secret**.

### Create the Application

1. **Applications → Applications → Create**.
2. **Name:** `GameTheca`
3. **Slug:** `gametheca` (this becomes part of the issuer URL)
4. **Provider:** the provider you just created
5. **Launch URL (optional):** `https://games.example.com`

Issuer URL will look like:

```text
https://auth.example.com/application/o/gametheca/
```

(Note the trailing slash — copy it from Authentik’s provider/application overview if shown.)

---

## 3. Groups → GameTheca roles (optional but recommended)

1. Authentik → **Directory → Groups** → create:
   - `gametheca-admin`
   - `gametheca-librarian`
   - `gametheca-child`
2. Add users to the right groups.
3. Ensure the OAuth provider includes the **groups** claim (Authentik property mapping / scope for groups on that provider). GameTheca reads `OIDC_ROLE_CLAIM=groups` by default.

Default role map in GameTheca:

```json
{
  "gametheca-admin": "admin",
  "gametheca-librarian": "librarian",
  "gametheca-child": "child",
  "admin": "admin",
  "librarian": "librarian",
  "child": "child"
}
```

Users with no mapped group become role `user`.

---

## 4. Set GameTheca env on Unraid

Edit the GameTheca Docker template / `.env` (however you inject env vars on Unraid).

```env
OIDC_ENABLED=true
OIDC_ISSUER_URL=https://auth.example.com/application/o/gametheca/
OIDC_CLIENT_ID=<paste Client ID>
OIDC_CLIENT_SECRET=<paste Client Secret>
OIDC_REDIRECT_URI=https://games.example.com/login/oidc/callback
OIDC_SCOPES=openid email profile
OIDC_ROLE_CLAIM=groups
OIDC_ROLE_MAP={"admin":"admin","gametheca-admin":"admin","librarian":"librarian","gametheca-librarian":"librarian","child":"child","gametheca-child":"child"}
OIDC_DISPLAY_NAME=Sign in with SSO

# Critical behind Unraid reverse proxy (Swag / NPM / Traefik)
TRUSTED_PROXIES=1
SESSION_COOKIE_SECURE=true
REMEMBER_COOKIE_SECURE=true
```

Then **Apply / Restart** the GameTheca container.

### Why `TRUSTED_PROXIES=1`?

Unraid reverse proxies terminate HTTPS and talk HTTP to the container. Without trusting one proxy hop, Flask builds callback URLs as `http://…:5006/...`, Authentik rejects them, and cookies misbehave. `TRUSTED_PROXIES=1` makes GameTheca honor `X-Forwarded-Proto: https`.

Confirm your proxy sends at least:

- `X-Forwarded-Proto`
- `X-Forwarded-For`
- `Host` (or `X-Forwarded-Host`)

---

## 5. Enable the second switch in Admin UI

Env alone is not enough.

1. Log in to GameTheca with a **local admin** account (username/password).
2. **Admin → Integrations → OIDC / SSO**.
3. Enable **Enable OIDC SSO**.
4. Confirm issuer, client ID, redirect URI match Authentik.
5. Set **Site URL** to `https://games.example.com` (public HTTPS base).

Both must be on:

1. `OIDC_ENABLED=true` in Docker env  
2. Admin Integrations toggle  

---

## 6. Smoke test

1. Log out of GameTheca.
2. Open `/login` — you should see **Sign in with SSO**.
3. Click it → Authentik login page (HTTPS on `auth.example.com`).
4. After Authentik login → back to `https://games.example.com/login/oidc/callback` (not `http://IP:5006`).
5. You land on Discover; refresh keeps the session.
6. If the user is in `gametheca-admin`, their GameTheca role should be `admin`.

### Common Unraid failures

| Symptom | Fix |
|--------|-----|
| No SSO button | Restart container after env change; enable Admin Integrations toggle |
| Redirect URI mismatch | Authentik redirect URI must equal `OIDC_REDIRECT_URI` exactly |
| Callback is `http://192.168.x.x:5006/...` | Set `TRUSTED_PROXIES=1`; fix proxy `X-Forwarded-Proto` |
| Instant logout after SSO | Cookies: keep `SESSION_COOKIE_SECURE=true` only when users use HTTPS |
| Wrong / missing email | Authentik user needs email; GameTheca matches local users by email first |

---

## 7. Order of operations (short checklist)

- [ ] Authentik installed + HTTPS on Unraid  
- [ ] OAuth2 provider + Application (`slug` = issuer path)  
- [ ] Redirect URI = `https://<gametheca>/login/oidc/callback`  
- [ ] Groups + groups claim (optional)  
- [ ] GameTheca Docker: `OIDC_*` + `TRUSTED_PROXIES=1` + secure cookies  
- [ ] Restart GameTheca  
- [ ] Admin → Integrations → enable OIDC + set Site URL  
- [ ] Smoke SSO login  

---

## Appendix A — LAN HTTP Authentik (no reverse proxy yet)

Use this when Authentik is reachable only on the LAN, e.g. `http://192.168.50.116:9000`.

```env
OIDC_ENABLED=true
OIDC_ISSUER_URL=http://192.168.50.116:9000/application/o/gametheca/
OIDC_CLIENT_ID=<from Authentik>
OIDC_CLIENT_SECRET=<from Authentik>
OIDC_REDIRECT_URI=http://<gametheca-lan-host>:5006/login/oidc/callback
TRUSTED_PROXIES=0
SESSION_COOKIE_SECURE=false
REMEMBER_COOKIE_SECURE=false
```

In Authentik, register the **same** redirect URI (HTTP is fine for lab only). Create a local GameTheca admin first — SSO stays optional until both env + Admin Integrations toggles are on.

When you later put HTTPS in front, flip cookies to `true`, set `TRUSTED_PROXIES=1`, and update issuer/redirect to HTTPS URLs.

