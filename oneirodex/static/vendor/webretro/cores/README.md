# WebRetro cores (operator-owned)

Place `{core_id}_libretro.js` + `{core_id}_libretro.wasm` here.

## Quick path

```bash
# Refresh the 24 default cores from webretro@6.5 (jsDelivr)
./scripts/fetch-webretro-cores.sh --defaults

# Add deferred PCE / VICE / DOS from a local build pack
./scripts/fetch-webretro-cores.sh --from-dir ~/built-webretro-cores
```

Windows: `.\scripts\fetch-webretro-cores.ps1 -Defaults`

## After drop

No `base.js` edit needed — `/api/emulator/installed-cores.js` lists cores from disk.
Restart only if not using a live bind-mount. Verify:

```bash
curl -sS "$BASE/api/emulator/health" | jq '.deferred_cores, .installed_cores'
```

Full guide: [docs/runbooks/webretro-cores.md](../../../../../docs/runbooks/webretro-cores.md)
