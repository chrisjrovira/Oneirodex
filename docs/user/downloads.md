# Downloads

## Where

- Top nav **Downloads** → `/downloads` (React page: queue + history).
- **Download** on a game details page streams a zip of the on-disk title (and selected version when multi-version exists).

## Behavior

- Download is server-side streaming; large titles depend on disk and network to the GameTheca host.
- Web UI does not install/extract on your PC — that needs the optional desktop companion (**Install / Update / Uninstall**). See [desktop-companion.md](desktop-companion.md).
- History lists past downloads for your account; queue shows in-progress work when the client/server reports it.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Button missing / disabled | No path on disk, ACL, or unfinished scan |
| Download fails mid-stream | Disk full, path moved, reverse-proxy timeouts |
| Page unstyled | Missing `member-app.css` — admin rebuild |

Related: [getting-started.md](getting-started.md) · admin scan docs [libraries-and-scans.md](../admin/libraries-and-scans.md)
