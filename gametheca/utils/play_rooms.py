"""Per-system "room" treatment for the play surface (FEAT-D5).

The existing platform skins group by **brand** (Nintendo / Sony / Sega / …),
which is the right axis for library chrome. Play is a different question: what
did playing this thing actually feel like, and where were you sitting?

So rooms group by **setting** instead:

``crt_living_room``
    Cartridge consoles on a family TV — warm lamp light, scanlines, wood.
``arcade_cabinet``
    Coin-op and Neo Geo AES — dark room, marquee glow, high contrast.
``handheld``
    Bus/backseat play — small screen, daylight, plastic shell.
``disc_era``
    32-bit/64-bit under-the-telly boxes — cooler light, CD-tray blue.
``desk``
    Home computers and DOS — desk lamp, beige, monitor phosphor.

A room is data: palette + ambience + which era font to pair. Nothing here
imitates a manufacturer's trade dress; it is period *setting*, not branding.
"""

from __future__ import annotations

from gametheca.utils.theme_fonts import font_for_platform

ROOMS: dict[str, dict] = {
    'crt_living_room': {
        'label': 'Living room CRT',
        'blurb': 'Cartridge console on the family television.',
        'ambience': 'scanlines',
        'backdrop': '#1a1410',
        'glow': '#ffb765',
        'accent': '#e8c07d',
        'surface': 'wood',
    },
    'arcade_cabinet': {
        'label': 'Arcade cabinet',
        'blurb': 'Dark room, marquee overhead, coins on the bezel.',
        'ambience': 'marquee',
        'backdrop': '#08060f',
        'glow': '#ff2d6f',
        'accent': '#25e0ff',
        'surface': 'blacklight',
    },
    'handheld': {
        'label': 'Handheld',
        'blurb': 'Small screen, daylight, plastic shell.',
        'ambience': 'daylight',
        'backdrop': '#20262b',
        'glow': '#9bd67a',
        'accent': '#c9d6a0',
        'surface': 'plastic',
    },
    'disc_era': {
        'label': 'Disc era',
        'blurb': 'Under the telly, tray open, memory card clicking in.',
        'ambience': 'cool',
        'backdrop': '#0b1220',
        'glow': '#3f9bff',
        'accent': '#7fd3ff',
        'surface': 'matte',
    },
    'desk': {
        'label': 'Desk',
        'blurb': 'Home computer, desk lamp, phosphor glow.',
        'ambience': 'phosphor',
        'backdrop': '#0d1410',
        'glow': '#5ef08a',
        'accent': '#a9f7c1',
        'surface': 'beige',
    },
}

DEFAULT_ROOM = 'crt_living_room'

PLATFORM_ROOMS: dict[str, str] = {
    # Cartridge consoles on a TV
    'NES': 'crt_living_room',
    'SNES': 'crt_living_room',
    'N64': 'crt_living_room',
    'SEGA_MD': 'crt_living_room',
    'SEGA_MS': 'crt_living_room',
    'SEGA_32X': 'crt_living_room',
    'SEGA_SG1000': 'crt_living_room',
    'ATARI_2600': 'crt_living_room',
    'ATARI_5200': 'crt_living_room',
    'ATARI_7800': 'crt_living_room',
    'INTV': 'crt_living_room',
    'COLECO': 'crt_living_room',
    'CHAF': 'crt_living_room',
    'O2EM': 'crt_living_room',
    'VECTREX': 'crt_living_room',
    'ASTROCADE': 'crt_living_room',
    'ARCADIA': 'crt_living_room',
    'CREATIVISION': 'crt_living_room',
    'STUDIO2': 'crt_living_room',
    'PCE': 'crt_living_room',
    'SUPERGRAFX': 'crt_living_room',
    'GX4000': 'crt_living_room',

    # Coin-op and cabinet-derived hardware
    'ARCADE': 'arcade_cabinet',
    'NEOGEO': 'arcade_cabinet',
    'NEOGEO_CD': 'arcade_cabinet',
    'DAPHNE': 'arcade_cabinet',
    'PINBALL': 'arcade_cabinet',

    # Handhelds
    'GB': 'handheld',
    'GBC': 'handheld',
    'GBA': 'handheld',
    'NDS': 'handheld',
    'N3DS': 'handheld',
    'LYNX': 'handheld',
    'NGP': 'handheld',
    'NGPC': 'handheld',
    'WS': 'handheld',
    'SUPERVISION': 'handheld',
    'PSP': 'handheld',
    'PSVITA': 'handheld',
    'ADVISION': 'handheld',

    # Optical-disc generation
    'PSX': 'disc_era',
    'PS2': 'disc_era',
    'PS3': 'disc_era',
    'SEGA_CD': 'disc_era',
    'SEGA_SATURN': 'disc_era',
    'SEGA_DC': 'disc_era',
    'NGC': 'disc_era',
    'WII': 'disc_era',
    'THREEDO': 'disc_era',
    'PCFX': 'disc_era',
    'PCE_CD': 'disc_era',
    'JAGUAR': 'disc_era',
    'SWITCH': 'disc_era',

    # Computers
    'PCWIN': 'desk',
    'PCDOS': 'desk',
    'MAC': 'desk',
    'AMIGA': 'desk',
    'VICE_X64SC': 'desk',
    'VICE_X128': 'desk',
    'VICE_XVIC': 'desk',
    'VICE_XPLUS4': 'desk',
    'VICE_XPET': 'desk',
}


def room_id_for_platform(platform_key: str | None) -> str:
    return PLATFORM_ROOMS.get((platform_key or '').strip().upper(), DEFAULT_ROOM)


def room_for_platform(platform_key: str | None) -> dict:
    """Full room treatment for a platform, including its era font.

    Returns the default room for anything unmapped rather than raising — a new
    console should look plausible on day one, not break the play page.
    """
    room_id = room_id_for_platform(platform_key)
    room = dict(ROOMS[room_id])
    font = font_for_platform(platform_key)
    room.update({
        'id': room_id,
        'platform': (platform_key or '').strip().upper() or None,
        'font_stack': font['stack'],
        'font_label': font['label'],
    })
    return room


def room_css_vars(platform_key: str | None) -> dict[str, str]:
    """Custom properties the play surface can apply directly.

    Emitted as data rather than a stylesheet so the caller decides scope — the
    play page themes itself without a global theme switch.
    """
    room = room_for_platform(platform_key)
    return {
        '--gt-room-backdrop': room['backdrop'],
        '--gt-room-glow': room['glow'],
        '--gt-room-accent': room['accent'],
        '--gt-room-font': room['font_stack'],
    }
