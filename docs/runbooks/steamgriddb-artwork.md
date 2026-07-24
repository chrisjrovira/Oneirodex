# SteamGridDB artwork provider

Enable community artwork from [SteamGridDB](https://www.steamgriddb.com/) for admin artwork search. GameTheca uses SteamGridDB for **artwork only** — it never downloads games or DRM payloads.

Supported image types: **cover** (grids), **logo**, **hero**.

## Enable

1. Sign in at SteamGridDB and create an API key under **Profile → Preferences**.
2. Set the key in your environment:

   ```bash
   STEAMGRIDDB_API_KEY=your_key_here
   ```

3. Restart GameTheca (or recreate the Docker container so env vars reload).

Optional: the key can also be stored in `global_settings.steamgriddb_api_key` (env takes precedence), matching the `steam_web_api_key` pattern.

## Verify

- **Admin → Integrations → Artwork** shows Enabled with a masked key preview.
- **API** (admin session required):

  ```http
  GET /api/providers
  GET /api/providers/steamgriddb/search?q=Celeste
  GET /api/providers/steamgriddb/search?q=Celeste&image_type=logo
  GET /api/providers/steamgriddb/search?q=Celeste&image_type=hero
  ```

Without a key, `/api/providers` lists SteamGridDB as disabled and search returns **503** with a clear configuration message.

## Apply artwork

`POST /api/games/<uuid>/artwork/steamgriddb` (admin session) with body:

```json
{ "url": "https://…", "image_type": "cover" }
```

`image_type` may be `cover`, `logo`, or `hero`. Downloads the image (artwork only), saves under `library/images/`, replaces existing rows of that type, and returns `{ image_id, filename, cover_url|url, image_type }`.

IGDB remains available as a second provider for **covers only**.

## Admin UI

**Edit Images** for a game includes an artwork search panel: pick SteamGridDB or IGDB, choose cover/logo/hero (SGDB), search, and click a result to apply.

## Troubleshooting

| Symptom | Check |
|---|---|
| Search returns 503 | `STEAMGRIDDB_API_KEY` unset or container not restarted |
| Search returns 401 | Key revoked or invalid — regenerate at SteamGridDB |
| Empty results | Query spelling; game may not exist on SteamGridDB |
| IGDB + logo/hero | IGDB only supports covers — switch provider or image type |

See also: `.env.example`, `docs/strategy/features.md` (P0-7 plugin framework).
