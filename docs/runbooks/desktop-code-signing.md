# Desktop code signing (Windows / Tauri)

Unsigned builds work for local use. Signing reduces SmartScreen / AV false positives when you distribute binaries.

## Prerequisites

1. A Windows code-signing certificate (EV preferred for reputation; standard OV works).
2. Certificate installed in the build machine’s certificate store **or** available as `.pfx` + password via CI secrets.
3. Tauri 2 bundling enabled (`bundle.active: true`) when you are ready to ship installers.

## Local env (never commit)

```env
# Preferred: thumbprint of cert in CurrentUser\My
TAURI_SIGNING_IDENTITY=<certificate-sha1-thumbprint>

# Or PFX path for CI runners
WINDOWS_CERTIFICATE_PATH=C:\certs\gametheca.pfx
WINDOWS_CERTIFICATE_PASSWORD=<secret>
```

## Tauri config

`clients/desktop/src-tauri/tauri.conf.json` reads Windows signing from env when set. Leave unset for unsigned local builds.

## GitHub Actions

Workflow `.github/workflows/desktop-build.yml` builds on `windows-latest`. Signing runs only when secrets are present:

- `WINDOWS_CERTIFICATE` — base64-encoded `.pfx`
- `WINDOWS_CERTIFICATE_PASSWORD`

Without secrets, the job still produces an **unsigned** artifact.

## Checklist before public release

- [ ] Cert purchased / org cert issued  
- [ ] `npm run tauri:build` produces signed `.msi` / `.exe` locally  
- [ ] CI secrets set; workflow green  
- [ ] Smoke: install on a clean Windows VM; SmartScreen reputation improves over time with EV  

## Out of scope here

Buying the certificate, Apple notarization, Linux package signing.
