# Controllers & VR / headset browse

## Controllers (Big Picture)

Open **More → Big Picture** for a gamepad-first library rail.

| Action | Xbox-style | DualSense / PlayStation-style | Keyboard |
|---|---|---|---|
| Move | D-pad / left stick | D-pad / left stick | Arrow keys |
| Open game | **A** | **×** | Enter |
| Download | **X** | **□** | `D` |
| Attract / trailers | **B** | **○** | `B` |
| Friends companion | **Y** | **△** | (Friends button / `Y` on pad) |
| Exit / blur | — | — | `Esc` |
| First / last | — | — | `Home` / `End` |

Kid mode uses the same browse controls; parental ACL already filters the list. Download may be unavailable for child accounts.

**Steam Deck / Steam Input:** If you launch the browser from Steam, Steam can remap controls. GameTheca uses the browser Gamepad API — it does not ship a separate Steam Input profile yet.

**WebRetro / native emulators** use each core’s own binds — see [browser-play.md](browser-play.md).

## Headsets (not Quest-only)

`/vr` (when admin enables **VR browse**) is a **large-target library** for any headset-friendly seat:

| You have… | Do this |
|---|---|
| **PSVR2 / Index / Vive via SteamVR** (PC VR) | On the **same PC**, open GameTheca in Chrome/Edge (desktop window or SteamVR overlay browser). Use **Big Picture** with a normal gamepad for couch control. Sense controllers are for SteamVR games, not for driving the website. |
| **Quest / standalone** (friend seat) | Headset browser → `https://<server>/vr` → optional Add to Home (PWA). Play heavy titles via **Moonlight** to the household PC, or ask someone on the companion PC. |
| **No headset** | Normal Library + Big Picture on TV. |

Details and strategy: [headset-vr.md](../strategy/headset-vr.md) · [controller-input.md](../strategy/controller-input.md).
