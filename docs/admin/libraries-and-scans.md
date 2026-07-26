# Libraries & scans

Admin surfaces today are **Jinja** under `base_admin` (top bar). A React admin SPA is planned; paths below stay valid during migration.

## Add a library

1. Admin → Libraries (create / manage).
2. Point the folder at the games mount (Docker: under `/storage/...`).
3. Set **scan depth** on create/edit (GET seeds the form; save persists it).
4. Prefer a small test scan before a full library scan.

## Run a scan

- Start from library tools / scan management.
- Watch job status on Ops / scan UI; do not start overlapping full scans on the same tree unless you know the job model.
- Propose-only mode (when enabled) writes proposals instead of committing matches — review before apply.

## After scan

- Unmatched titles → Identify workbench (IGDB / Steam / GOG / RAWG).
- Covers/images may queue separately; freshness tools mark OUT/~ titles.
- Members see new platforms on **Systems** (`/systems`) once platforms appear in `/api/library_platforms`.

## Deploy note

Games volume is often **read-only** in Compose (`/storage:ro`). Scans identify and enrich metadata; they do not rewrite the games share unless you mount RW and use tools that allow it.

Related: [themes-reset.md](themes-reset.md) · [settings-modules.md](settings-modules.md) · [unraid-deploy.md](../runbooks/unraid-deploy.md)
