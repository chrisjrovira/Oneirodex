from enum import Enum as PyEnum

class LibraryPlatform(PyEnum):
    OTHER = "Other"
    PCWIN = "PC Windows"
    PCDOS = "PC DOS"
    MAC = "Mac"
    NES = "Nintendo Entertainment System (NES)"
    SNES = "Super Nintendo Entertainment System (SNES)"
    NGC = "Nintendo GameCube"
    N64 = "Nintendo 64"
    GB = "Nintendo GameBoy"
    GBA = "Nintendo GameBoy Advance"
    GBC = "Nintendo GameBoy Color"
    NDS = "Nintendo DS"
    VB = "Nintendo Virtual Boy"
    SEGA_MD = "Sega Mega Drive/Genesis (MD)"
    SEGA_MS = "Sega Master System (MS)"
    SEGA_CD = "Sega CD"
    SEGA_32X = "Sega 32X"
    SEGA_GG = "Sega Game Gear (GG)"
    SEGA_SATURN = "Sega Saturn"
    ATARI_7800 = "Atari 7800"
    ATARI_5200 = "Atari 5200"
    ATARI_2600 = "Atari 2600"
    LYNX = "Atari Lynx"
    JAGUAR = "Atari Jaguar"
    PCE = "PC Engine"
    PCFX = "PC-FX"
    NGP = "Neo Geo Pocket"
    WS = "WonderSwan"
    COLECO = "ColecoVision"
    THREEDO = "3DO"
    VECTREX = "Vectrex"
    VICE_X64SC = "Commodore 64 (VIC-20)"
    VICE_X128 = "Commodore 128"
    VICE_XVIC = "Commodore VIC-20"
    VICE_XPLUS4 = "Commodore Plus/4"
    VICE_XPET = "Commodore PET"
    XBOX = "Xbox"
    X360 = "Xbox 360"
    XONE = "Xbox One"
    XSX = "Xbox Series X"
    PSX = "Sony Playstation (PSX)"
    PS2 = "Sony PS2"
    PS3 = "Sony PS3"
    PS4 = "Sony PS4"
    PS5 = "Sony PS5"
    INTV = "Intellivision"
    CHAF = "Fairchild Channel F"
    O2EM = "Magnavox Odyssey 2"
    NEOGEO_CD = "Neo Geo CD"


class Emulator(PyEnum):
    """Libretro core IDs. Prefer good-standing cores that ship in WebRetro WASM."""

    DOSBOX = "dosbox"
    DOSBOX_PURE = "dosbox_pure"
    GENESIS_PLUS_GX = "genesis_plus_gx"
    YABAUSE = "yabause"
    STELLA = "stella"
    STELLA2014 = "stella2014"
    A5200 = "a5200"
    A2600 = "a2600"
    A7800 = "a7800"
    PROSYSTEM = "prosystem"
    VIRTUALJAGUAR = "virtualjaguar"
    HANDY = "handy"
    OPERA = "opera"
    MEDNAFEN_GBA = "mednafen_gba"
    NEOCD = "neocd"
    NESTOPIA = "nestopia"
    MUPEN64PLUS_NEXT = "mupen64plus_next"
    PARALLEL_N64 = "parallel_n64"
    MELODS = "melonds"
    DOLPHIN = "dolphin"
    MEDNAFEN_WSWAN = "mednafen_wswan"
    MEDNAFEN_NGP = "mednafen_ngp"
    MEDNAFEN_VB = "mednafen_vb"
    SNES9X = "snes9x"
    MEDNAFEN_PSX_HW = "mednafen_psx_hw"
    GEARCOLECO = "gearcoleco"
    VECX = "vecx"
    MGBA = "mgba"
    O2EM = "o2em"
    FREEINTV = "freeintv"
    FREECHAF = "freechaf"

    # Legacy aliases kept for admin profiles that still store old enum-style values.
    SEGA_MD = "genesis_plus_gx"
    SEGA_MS = "genesis_plus_gx"
    SEGA_CD = "genesis_plus_gx"
    SEGA_32X = "genesis_plus_gx"
    SEGA_GG = "genesis_plus_gx"
    SEGA_SATURN = "yabause"
    LYNX = "handy"
    THREEDO = "opera"
    PSX = "mednafen_psx_hw"
    COLECO = "gearcoleco"
    VECTREX = "vecx"
    GB = "mgba"
    GBA = "mgba"
    GBC = "mgba"


# Cores present under gametheca/static/vendor/webretro/cores (WebRetro installedCores).
WEBRETR_INSTALLED_CORES = frozenset({
    'a5200', 'freechaf', 'freeintv', 'gearcoleco', 'genesis_plus_gx', 'handy',
    'mednafen_ngp', 'mednafen_psx_hw', 'mednafen_vb', 'mednafen_wswan', 'melonds',
    'mgba', 'mupen64plus_next', 'neocd', 'nestopia', 'o2em', 'opera', 'parallel_n64',
    'prosystem', 'snes9x', 'stella2014', 'vecx', 'virtualjaguar', 'yabause',
})


platform_emulator_mapping = {
    LibraryPlatform.OTHER: [],
    LibraryPlatform.PCWIN: [],
    LibraryPlatform.MAC: [],
    # DOS cores are not in the current WebRetro WASM bundle — keep mapping for
    # native/companion profiles but they are gated out of browser play.
    LibraryPlatform.PCDOS: [Emulator.DOSBOX_PURE, Emulator.DOSBOX],
    LibraryPlatform.NES: [Emulator.NESTOPIA],
    LibraryPlatform.SNES: [Emulator.SNES9X],
    LibraryPlatform.N64: [Emulator.MUPEN64PLUS_NEXT, Emulator.PARALLEL_N64],
    LibraryPlatform.GB: [Emulator.MGBA],
    LibraryPlatform.GBA: [Emulator.MGBA],
    LibraryPlatform.GBC: [Emulator.MGBA],
    LibraryPlatform.NDS: [Emulator.MELODS],
    LibraryPlatform.VB: [Emulator.MEDNAFEN_VB],
    LibraryPlatform.PSX: [Emulator.MEDNAFEN_PSX_HW],
    LibraryPlatform.SEGA_MD: [Emulator.GENESIS_PLUS_GX],
    LibraryPlatform.SEGA_MS: [Emulator.GENESIS_PLUS_GX],
    LibraryPlatform.SEGA_CD: [Emulator.GENESIS_PLUS_GX],
    LibraryPlatform.SEGA_32X: [Emulator.GENESIS_PLUS_GX],
    LibraryPlatform.SEGA_GG: [Emulator.GENESIS_PLUS_GX],
    LibraryPlatform.SEGA_SATURN: [Emulator.YABAUSE],
    LibraryPlatform.ATARI_7800: [Emulator.PROSYSTEM],
    LibraryPlatform.ATARI_5200: [Emulator.A5200],
    LibraryPlatform.ATARI_2600: [Emulator.STELLA2014],
    LibraryPlatform.LYNX: [Emulator.HANDY],
    LibraryPlatform.JAGUAR: [Emulator.VIRTUALJAGUAR],
    LibraryPlatform.WS: [Emulator.MEDNAFEN_WSWAN],
    LibraryPlatform.NGP: [Emulator.MEDNAFEN_NGP],
    LibraryPlatform.COLECO: [Emulator.GEARCOLECO],
    LibraryPlatform.VECTREX: [Emulator.VECX],
    LibraryPlatform.THREEDO: [Emulator.OPERA],
    LibraryPlatform.NEOGEO_CD: [Emulator.NEOCD],
    LibraryPlatform.INTV: [Emulator.FREEINTV],
    LibraryPlatform.CHAF: [Emulator.FREECHAF],
    LibraryPlatform.O2EM: [Emulator.O2EM],
}


def core_is_browser_playable(core_id: str | None) -> bool:
    return bool(core_id) and str(core_id) in WEBRETR_INSTALLED_CORES
