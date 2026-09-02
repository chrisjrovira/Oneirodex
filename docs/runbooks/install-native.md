# Native install — Linux · macOS · Windows

Running Oneirodex directly on the machine, without Docker. Pick this when you
want the server to see the host's own disks and mounts with no bind-mount layer
in between, or when Docker is not available.

For containers, use [docker-compose-deploy.md](docker-compose-deploy.md) or
[unraid-deploy.md](unraid-deploy.md) instead.

## What you need

| | |
|---|---|
| Python | 3.11+ |
| PostgreSQL | 17+ (16 works; 17 is what CI and the images use) |
| Disk | ~1 GB for the app and dependencies, plus covers/artwork under `UPLOAD_FOLDER` |
| Port | 5006 by default |

The installers below check these, create a virtual environment, create the
databases, and write a `.env` with a generated `SECRET_KEY`. None of them
install Docker, and none of them expose Oneirodex to the internet — put a
reverse proxy in front for that ([login-rate-limit-proxy.md](login-rate-limit-proxy.md)).

---

## Linux

```bash
git clone --depth 1 https://github.com/chrisjrovira/oneirodex.git
cd oneirodex
chmod +x install-linux.sh
./install-linux.sh
```

Detects apt / dnf / yum / pacman / zypper and installs Python, PostgreSQL and
build tools, then configures the database and `.env`.

| Flag | Effect |
|---|---|
| `--games-dir PATH` | Games folder (prompted for otherwise) |
| `--library-roots S` | Extra scan locations — see [remote-scan-locations.md](remote-scan-locations.md) |
| `--port PORT` | Serve on a port other than 5006 |
| `--no-db` | Skip PostgreSQL; point `DATABASE_URL` at an existing server |
| `--dev` | Also install `requirements-dev.txt` |
| `--force` | Overwrite an existing `.env` / `config.py` |
| `--verbose` | Show the full output of every step |

```bash
./install-linux.sh --games-dir /srv/games \
  --library-roots 'NAS ROMs=/mnt/nas/roms|Archive=/mnt/archive'
```

Start it: `./startweb.sh` — then open http://localhost:5006

### Run at boot (systemd)

```ini
# /etc/systemd/system/oneirodex.service
[Unit]
Description=Oneirodex
After=network-online.target postgresql.service
Wants=network-online.target
# Wait for the share, or the first scan after a reboot finds an empty folder
RequiresMountsFor=/mnt/nas/roms

[Service]
Type=simple
User=oneirodex
Group=oneirodex
WorkingDirectory=/opt/oneirodex
ExecStart=/opt/oneirodex/startweb.sh
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now oneirodex
journalctl -u oneirodex -f
```

`RequiresMountsFor` is the line people leave out. Without it systemd starts
Oneirodex before the NAS mount is ready and the first scheduled scan sees
nothing.

---

## macOS

```bash
git clone --depth 1 https://github.com/chrisjrovira/oneirodex.git
cd oneirodex
chmod +x install-macos.sh
./install-macos.sh
```

Homebrew is required and is **not** installed for you — the official installer
is a script fetched over the network and run with your privileges, which is your
call to make, not the script's. If `brew` is missing you get the command and an
exit.

The installer takes the same flags as the Linux one. Homebrew's PostgreSQL
trusts the local account, so `DATABASE_URL` connects as you with no password.

Start it: `./startweb.sh`

### Run at login (launchd)

```xml
<!-- ~/Library/LaunchAgents/com.oneirodex.server.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.oneirodex.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/YOU/oneirodex/startweb.sh</string>
  </array>
  <key>WorkingDirectory</key><string>/Users/YOU/oneirodex</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/Users/YOU/oneirodex/oneirodex.log</string>
  <key>StandardErrorPath</key><string>/Users/YOU/oneirodex/oneirodex.err</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.oneirodex.server.plist
```

A `LaunchAgent` runs in your login session, so Finder-mounted shares are
visible. A `LaunchDaemon` (boot-time, no session) is not — it cannot see
`/Volumes` mounts made by Finder at all. If you need boot-time start with
network libraries, mount them with autofs first; see
[remote-scan-locations.md](remote-scan-locations.md#macos-host).

macOS may also withhold folder access from a background process. If a scan sees
an empty folder that is not empty, grant **Full Disk Access** to the terminal or
the launchd job in System Settings → Privacy & Security.

---

## Windows

```powershell
git clone --depth 1 https://github.com/chrisjrovira/oneirodex.git
cd oneirodex
.\install-windows.ps1
```

If PowerShell blocks the script, allow it for this session only:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Python and PostgreSQL are checked, not installed — both are system-wide changes
that prompt for elevation, so the script prints the exact `winget` command and
stops:

```powershell
winget install --id Python.Python.3.12 --source winget
winget install --id PostgreSQL.PostgreSQL.17 --source winget
```

The installer finds `psql.exe` under `C:\Program Files\PostgreSQL\*\bin` even
when it is not on `PATH`, so a stock PostgreSQL install needs no extra work.

| Parameter | Effect |
|---|---|
| `-GamesDir PATH` | Games folder |
| `-LibraryRoots S` | Extra scan locations (prefer UNC over mapped drives) |
| `-Port PORT` | Serve on a port other than 5006 |
| `-SkipDb` | Use an existing PostgreSQL database |
| `-Dev` | Also install `requirements-dev.txt` |
| `-Force` | Overwrite an existing `.env` / `config.py` |

```powershell
.\install-windows.ps1 -GamesDir 'D:\Games' -LibraryRoots 'NAS ROMs=\\nas\roms'
```

Start it: `.\startweb_windows.cmd`

### Run as a service

Windows has no built-in way to run a script as a service. Two workable options:

**Task Scheduler** (no extra software) — create a task that runs
`startweb_windows.cmd` *At startup*, under a **real user account** with *Run
whether user is logged on or not*. A real account matters: `LocalSystem` cannot
authenticate to a network share, so a NAS library goes unreachable.

**NSSM** for a proper service entry:

```powershell
nssm install Oneirodex "C:\oneirodex\startweb_windows.cmd"
nssm set Oneirodex AppDirectory "C:\oneirodex"
nssm set Oneirodex ObjectName ".\oneirodex-svc" "PASSWORD"
nssm start Oneirodex
```

Either way, mapped drive letters are per-user and will not resolve — use UNC
paths in `GT_LIBRARY_ROOTS`.

---

## After installing

1. Open http://localhost:5006 — the setup wizard creates the first admin.
2. **Admin → Libraries & scans** — add a library, point it at a folder, scan.
   Extra scan locations appear in the **Scan location** picker
   ([remote-scan-locations.md](remote-scan-locations.md)).
3. **Admin → Settings** — API keys, modules, SMTP
   ([settings-modules.md](../admin/settings-modules.md)).

## Upgrading

```bash
git pull
source venv/bin/activate            # Windows: venv\Scripts\activate
pip install -r requirements.txt
./startweb.sh
```

Schema migrations run on boot. `.env` is never overwritten by `git pull`; new
keys are added to `.env.example`, so diff the two after a major upgrade.

Coming from **≤ 0.1.0**: `DATA_FOLDER_WAREZ` was removed. Rename it to
`DATA_FOLDER_GAMES` or the app starts with no games folder.

## Resetting

```bash
./startweb.sh --force-setup         # Windows: .\startweb_windows.cmd --force-setup
```

Drops and recreates every table and re-runs the setup wizard. It destroys the
library database — game *files* on disk are untouched.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `SECRET_KEY environment variable is not set` | `.env` was not loaded, or still has the placeholder. Start via `startweb.sh`, not `python asgi.py` |
| `connection refused` on 5432 | PostgreSQL is not running — `systemctl status postgresql`, `brew services list`, or Services on Windows |
| `database ... does not exist` | Re-run the installer, or `createdb oneirodex` |
| Port 5006 in use | `PORT=5010 ./startweb.sh`, or `--port` at install time |
| Library grid unstyled | Frontend bundles missing — `cd frontend/member-app && npm ci && npm run build` |
| Scan sees an empty folder | Permissions or an unmounted share — [remote-scan-locations.md](remote-scan-locations.md#troubleshooting) |

More: [../admin/troubleshooting.md](../admin/troubleshooting.md) ·
[container-wont-start.md](container-wont-start.md) (Docker)
