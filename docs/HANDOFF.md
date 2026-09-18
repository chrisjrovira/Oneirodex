# Oneirodex — handoff to the post-1.0 agent

**Written 2026-09-18, at the end of the v1 cycle.** You are the new agent named in **D12**. This
file is the cold-start brief: it assumes you know nothing about the last three weeks and nothing
about this session. Read it top to bottom before touching anything.

> The same brief as a readable page, if you prefer it:
> **https://claude.ai/artifact/91Uf1H8FH8sDmrBAJcYRxN**

The plan you are executing is **Part B** of
`C:\Users\cephyrix_zyth\.claude\plans\glistening-chasing-turtle.md`. This file tells you where that
plan's starting line actually is, which is not quite where the plan says, because the last day
moved.

---

## 1. State of the world, measured not remembered

| | |
|---|---|
| `main` | `22a3f781` (merge of #139). Clean tree. **0 open PRs, 0 open issues.** |
| `VERSION` | `1.0.0` |
| Tags | **`v0.1.0` only — `v1.0.0` HAS NOT BEEN CUT.** See §4. |
| CHANGELOG | `[1.0.0] — 2026-09-18` exists with 245 folded bullets. An `[Unreleased]` section sits *above* it holding #135 and #139. |
| `GENERATOR_VERSION` | **39** (`oneirodex/utils/preset_themes.py:106`) |
| Live box | `192.168.50.116`, Docker on `:5006`. **Running `1.0.0` as of 2026-09-18** — deployed and verified. |
| Ratchets | api-envelope **11** · print-lint **591** · get_json **103** · css-token **0** · any **1,276** |
| CI | 9 jobs, all green on the tagged-to-be commit. |

Merged this cycle: **#113 – #139** (27 PRs). Nothing is half-landed; every branch merged or was
deleted.

---

## 2. What the cycle actually did

Phases 0–7 of the v1 plan, in order. The short version, by what changed for a user:

- **Phase 0–1 — the unreviewed delta.** PRs #77–#112 (a Cursor run of 427 files) had never been
  reviewed from this side. Reviewed by risk area, fixed what it found (#113), named the full-suite
  failures and fixed three stale assertions (#114).
- **Phase 2 — the modernization tail.** Five ADRs + an index (#115), the **D5 hygiene guard** so
  agent-harness files can never be re-tracked (#117), an explicit-`any` ratchet (#118, #122),
  api-client factories exported and six member wrappers moved onto typed modules (#120),
  `pytest-core` flipped to the marker set (#121), coverage floor 35 → 65 against a real 68 (#124).
- **Phase 3 — Discover.** Upcoming now shows what the household does *not* hold, with a release
  badge (#126).
- **Phase 4 — emulation, the big one.** The clock fixes actually reach the browser (#125),
  EmulatorJS as a second play engine (#128), a member engine picker (#129), the **save-state layer**
  — tiles read *Resume*, the room asks before loading (#130), and **RetroAchievements** hash
  matching against community sets (#131).
- **Phase 5 — themes.** Drawn room art per era (#132), per-console motif colour and rail glyphs
  de-duplicated into one shared module (#135).
- **Phase 6 — platform.** The member app installs: its own window, its own icon. One path serves
  thin seats and the Quest (#133).
- **Phase 7 — the release prep.** Every version surface aligned, 245 changelog bullets folded into
  a real `[1.0.0]` with upgrade notes (#134).
- **Then three rounds of review + bug scrub**, which is where the interesting part is — §5.

**A bug he never reported, found on the way:** the top-bar tile-size slider had *never* saved. Every
drag posted a single field, WTForms rejected the absent `SelectField`s as "Not a valid choice", the
whole save 400'd, and the size reverted on reload. Fixed in #129.

---

## 3. The deploy, and the thing that blocked it all day

The box refused **SSH (22)** and its **web GUI (80)** for most of 18 September while Docker
carried on serving `:5006` — so `/awake` kept truthfully reporting the *old* image, `1.0.0-beta`.
Cause, found once it came back: **the host had rebooted** (uptime 1:18 when SSH answered). Docker's
containers restarted; `sshd` and the GUI took much longer. Port 80 was *still* refused after SSH
returned, and the deploy does not need it.

**`22a3f781` was deployed and verified on 2026-09-18.** `/awake` reports `1.0.0`, database ok,
initialization complete; Reset Themes ran ("reset default theme + 15 presets"); the `flex-wrap` fix
from #139 is present in **all 16** theme copies on the volume, so generator 39 genuinely regenerated
them. SSO renders and Authentik answers 302.

Re-deploy with:

```bash
python scripts/ops/unraid_ship_update_now.py
curl -fsS http://192.168.50.116:5006/awake     # verify independently, not from the script's output
```

**`GENERATOR_VERSION` is 39, so Reset Themes is mandatory** — the ship script pipes it, but confirm
it ran, or the rooms stay flat. Theme CSS/JS/art are served from a **Docker volume, not the image**:
a rebuild alone changes nothing visible.

Do not pipe that script through `tail`. It masks the exit code, and a failed SSH then looks like a
clean exit — this cost an hour.

### Orphan pruning — read this before you prune anything

His instruction was *"prune one by one as i have other dockers not running due to cpu constraints
that need to stay."*

**Every stopped container on that box is one of his.** Jellyfin, Plex-Media-Server, Sonarr, Radarr,
shoko-server, the four-container audiotheca stack, bytemark-smtp, XnViewMP, IT-Tools. **Containers
are off the table.** `docker container prune` would destroy exactly what he warned about.

The real orphans were **101 dangling images** (`<none>:<none>`, ~615–670 MB each), untagged
leftovers from repeated Oneirodex builds. **Done on 2026-09-18:** removed one at a time with
`docker rmi` and **no `-f`**, so Docker itself would refuse anything still referenced. All 101 went,
none refused, all 24 containers intact afterwards. Images 131 → 30, **49.64 GB → 12.27 GB**.

Use that same method for any future prune: one `docker rmi` per image, never `-f`, never a blanket
`docker image prune -a` — the latter also evicts tagged images his stopped containers need in order
to restart. Leave volumes alone entirely without asking; they hold data.

**Still outstanding, and the reason the box is fragile:** `/var/lib/docker` is at **93 %**
(880 G of 954 G). After the image prune, **build cache is 70.59 GB with 68.63 GB reclaimable**.
`docker builder prune` is non-destructive — it costs only rebuild time — but he is CPU-constrained
and slower rebuilds are a real cost to him, so **ask before running it**. It is very likely the disk
pressure behind the reboot that started this whole detour.

---

## 4. The tag — the one thing 1.0.0 is still missing

`v1.0.0` does not exist. Only `v0.1.0` is in the tag list.

**There is an inconsistency you must resolve before tagging.** `[1.0.0]`'s upgrade note tells the
reader `GENERATOR_VERSION` moved "36 → 37". The tree actually ships **39**, because #135 and #139
landed *after* #134 and sit in `[Unreleased]`. So a `v1.0.0` tag cut at `main` today would ship code
whose own release notes understate what Reset Themes is for. Pick one:

- **fold `[Unreleased]` into `[1.0.0]`**, correct the generator line to 39, then tag — cleanest; or
- tag `v1.0.0` at **#134** and release the two fixes as `1.0.1`.

Either is defensible. Do not tag without choosing.

**He has not authorized the tag yet.** The Human Queue item `p7-tag` offers him *"Tag it once your
checks pass"* vs *"Hold — I want to look first"* and he has answered neither. Tagging is the one
action in this cycle that is genuinely hard to undo in public. **Ask before you tag.**

Before the tag, the plan's verification section requires: all five ratchets, CI fully green on the
tagged commit, `alembic upgrade head` + `alembic check` on a **fresh** database, README/guide
screenshots recaptured from the running instance (this is all MISS-DOC-4 / MISS-QA-4 were ever
blocked on), and a **live** check — not a source check — of the resume prompt, the engine picker and
a themed room.

---

## 5. The review rounds, and one lesson worth inheriting

Three rounds of code review and bug scrub, run until a round found nothing. Six real bugs, each
fixed with a regression test. The two worth knowing about, because they are patterns:

- **`g` is app-context scoped, not request scoped.** An engine-availability cache keyed on Flask's
  `g` was changed to `has_app_context()` because it made a test pass. Review round 1 correctly
  called that a real bug — in a worker context it would go stale *forever*. Reverted to request
  scope. Making the test pass was the wrong fix; the test was right.
- **Service-worker caching must enforce versioning, not assume it.** `app-sw.js` trusted a path
  prefix, but `/static/vendor/` also holds EmulatorJS, whose loader is fetched with no `?v=`. An
  installed app would have booted stale cores forever, unreachable except by uninstalling. The rule
  now requires a content hash or a `?v=`.

### The measurement lesson — please actually read this one

Every page was walked in a real browser: 53 routes, all 200, all rendered, no console errors.

The first overflow pass compared `scrollWidth` against a **hardcoded 390** while the browser pane
was actually **639** wide. It produced six plausible, confident findings. Re-measuring against each
document's own `clientWidth` — and finally against **child-wider-than-parent**, which needs no
viewport assumption at all — confirmed exactly **one** of the six. The bad method named the same
pages as the good one. That was luck, not corroboration.

Only the `.od-seg` case was real (`inline-flex`, no `flex-wrap`; a six-item strip on Admin →
Integrations was **457px wide inside a 315px parent**). Fixed in #139.

The other four readings are **probably an emulation artifact**, and `docs/dev/ui-debt-log.md`
(UID-064) says so with a warning not to "fix" from those numbers. Evidence: no CSS rule anywhere
sets a width on `#admin-legacy-content` (every matching rule was enumerated — only `min-width: 0`
and `max-width: 1600px`), no descendant is that wide, and its computed width tracks the *pane's real
width* while `body`, `html` and the grid track all correctly report the emulated width.

**If you re-measure layout, measure against the document's own `clientWidth`, or compare a child to
its parent. Never against a number you typed in.**

---

## 6. Eleven things that need his eyes

Live at **https://claude.ai/artifact/U7qhn9GWpm1TzTPdxJjRtP** (*Oneirodex Human Queue*). He answers
in the page; read the answers back with `ArtifactData` on collection `checklist`.

**All eleven are still unanswered.** The 15 rows currently in that collection are the *previous*
batch, answered 6 September — do not mistake them for these.

| id | What you need from him |
|---|---|
| `p7-ssh` | **Now stale** — SSH came back on its own. Update or retire this row. |
| `p7-rooms` | Do the era rooms look like rooms? Should the whole scene tint to the theme, or keep era colours with only the screen glow following? |
| `p7-resume` | Leave a game, come back — does the tile read *Resume*, does the room *ask* before loading, does a named save appear on the details page? |
| `p7-play-lines` | Two console lines (`Display refresh measured:` and `Audio device: 48000Hz`), and whether the crackle actually changed. **No amount of code reading closes this row.** |
| `p7-discover` | Upcoming contents, News scrollbar spacing, drag-to-pan feel. |
| `p7-engine` | Needs `fetch-emulatorjs.sh` run first. Which engine feels better. |
| `p7-grid-topbar` | **Blocked on his description.** "Grid still hides the thin top bar" — nothing in the tree hides, fades or covers `.od-topbar`, and the old fade rule was deleted 31 August. Three different mechanisms produce "the bar is hidden" and each has a different fix. A screenshot settles it. Last thing keeping UID-020 open. |
| `p7-ra-keys` | `RETROACHIEVEMENTS_USERNAME` + `RETROACHIEVEMENTS_API_KEY` in the live `.env`. **He places them himself. Never handle the key value.** #131 is inert without them. |
| `p7-emulatorjs-fetch` | `scripts/fetch-emulatorjs.sh` on the box — bind is mounted and empty by design (core licences are his to accept). |
| `p7-tls` | **Load-bearing now.** The installable app cannot appear at all on plain HTTP — service workers need a secure origin, so the *Install this library* row is hidden by design on `:5006`. Also gates SSO cleanly and passkeys. Needs a hostname and which proxy terminates it. |
| `p7-tag` | Authorization to cut `v1.0.0`. See §4. |

Also still his, carried from before: **SMTP** (the DB row is empty, so no mail sends at all), Docker
Hub publish, Authentik, unsigned desktop distribution, and the non-commercial core clauses
(`snes9x`, `genesis_plus_gx` — counsel is a human).

---

## 7. Standing constraints — do not re-litigate these

Rulings that already exist. Re-asking them wastes his time.

| # | Ruling |
|---|---|
| **D2** | Merge and deploy authority is delegated. One PR per phase, merged on fully green CI. Don't ask. |
| **D5** | `CLAUDE.md`, `AGENTS.md`, `.claude/**`, `.cursor/**` **stay untracked**, CI-enforced by `tests/test_repo_hygiene.py`. Project conventions live in `CONTRIBUTING.md`. |
| **D9** | No QA-batch gating between phases. Items accumulate on the Human Queue. |
| **D10** | Tag 1.0.0 now; Phase 5/6 depth moves to post-1.0. |
| **D11** | **Debt gets its own phase, first**, before the feature tracks. |
| **D12** | A new agent (you) executes the post-1.0 program. |

Hard constraints: **no Discord · no Class A · no store downloads/DRM installs · never commit
unprompted · never overwrite the root `.env` · desktop code signing is permanently out of scope**
("no not buying certs", 2026-09-17). Cheats: Option A shipped, **Option B is askable only once** the
L6 stance and INSP-35 both exist.

---

## 8. Where to start

Per **D11**, debt first. `Phase H-D` in the plan file, biggest first:

1. **13 components over 600 lines** — `GameDetailsPage` 1,274 · `ChatPanel` 1,097 · `DupeGlance`
   1,008 · `ArtStudioPage` 895 · `ImagesPage` 869 · `LibraryApp` 858 · `TrailersPage` 854 ·
   `GameCard` 812. Deferred twice by explicit decision ("rename+type now, decompose later"). This is
   later.
2. **109 raw `<button className="od-btn">`** sites, plus the deferred `Modal`/`DataTable`/`showToast`
   primitives and the still-duplicated `toast`.
3. **~160 untyped `.test.js(x)`** files → then flip `tsconfig.base.json` to `strict: true` and delete
   the six local overrides.
4. **Backend god-modules** — note `updateschema.py` (1,700) is **frozen, not deleted**, by ADR 0004.
5. **~40 remaining admin Jinja→React** bodies.

Then `H-T` (the D10 remainders), then `H1`–`H4` (the capability harvest), then `H-I`.

### Environment hazards — do not rediscover these

- Git here needs `-c safe.directory='*'`. Ops take minutes and look hung.
- Recursive `find`/`grep -r` over the tree **times out**. Scope to explicit paths.
- **npm workspaces cannot install on `Z:`** — SMB blocks npm's junctions. All frontend work happens
  in the `C:\od-modz\v1-fe4` NTFS worktree. Backend and docs are fine on `Z:`.
- `Z:` **is** the NAS checkout the box builds from, and it is **shared with other sessions**. Stage
  explicit paths; never `git add -A`.
- `Path.write_text()` defaults to cp1252 here. Always pass `encoding='utf-8'`.
- Bash heredocs mangle `{{`, apostrophes and `\x` escapes. Use the Write tool or standalone scripts.
- Test DB creds are **postgres/postgres**, container `oneirodex-review-db`, and
  `TEST_DATABASE_URL` must contain `test`.

### Read next, in this order

1. `superpowers/plans/2026-09-16-v1-cycle.md` — the board
2. `C:\Users\cephyrix_zyth\.claude\plans\glistening-chasing-turtle.md` — Part B, your actual plan
3. `strategy/capability-harvest-2026-09.md` — the register (**local-only**; `docs/strategy/` is
   gitignored by standing decision, and correctly so — it names competitors and trainer brands)
4. `dev/ui-debt-log.md` — UID-064 and the open UI rows
5. Memories: `v1-cycle-run-state`, `capability-harvest-state`,
   `nas-checkout-shared-and-git-guarded`, `deploy-topology-nas-is-the-checkout`,
   `verify-ui-fixes-in-live-browser`, `human-queue-artifact`
