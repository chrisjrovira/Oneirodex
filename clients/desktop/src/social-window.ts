import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

import { isTauriRuntime } from './config-store.js'
import { joinUrl } from './paths.js'

const SOCIAL_LABEL = 'social'

/** Compact Discord/Steam-friends-like size (matches member dock ~360×≤640). */
export const SOCIAL_POPUP = {
  width: 360,
  height: 560,
  minWidth: 300,
  minHeight: 400,
  /** Gap from work-area edges (Windows taskbar-aware via avail*). */
  margin: 16,
} as const

/** Last URL loaded into the Tauri `social` label (for Server URL change detection). */
let lastSocialUrl = ''

/** Member SPA route for the stay-open Friends companion. */
export function buildSocialCompanionUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim()
  if (!trimmed) {
    return ''
  }
  return joinUrl(trimmed, '/social-companion')
}

/** Test helper — reset module URL tracking between cases. */
export function resetSocialWindowUrlTracking(): void {
  lastSocialUrl = ''
}

export type SocialWindowPlacement = {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Bottom-right placement in the given work area (logical CSS pixels).
 * Clamps so the popup stays on-screen on short displays.
 */
export function resolveBottomRightPlacement(
  availWidth: number,
  availHeight: number,
  opts: {
    width?: number
    height?: number
    minWidth?: number
    minHeight?: number
    margin?: number
  } = {},
): SocialWindowPlacement {
  const margin = opts.margin ?? SOCIAL_POPUP.margin
  const minWidth = opts.minWidth ?? SOCIAL_POPUP.minWidth
  const minHeight = opts.minHeight ?? SOCIAL_POPUP.minHeight
  const preferW = opts.width ?? SOCIAL_POPUP.width
  const preferH = opts.height ?? SOCIAL_POPUP.height

  const maxW = Math.max(minWidth, availWidth - margin * 2)
  const maxH = Math.max(minHeight, availHeight - margin * 2)
  const width = Math.min(preferW, maxW)
  const height = Math.min(preferH, maxH)
  const x = Math.max(margin, Math.round(availWidth - width - margin))
  const y = Math.max(margin, Math.round(availHeight - height - margin))
  return { x, y, width, height }
}

/** Read main-window screen work area; falls back to a sensible desktop size. */
export function readScreenWorkArea(): { availWidth: number; availHeight: number } {
  try {
    const s = globalThis.screen
    const availWidth = Number(s?.availWidth) || Number(s?.width) || 1280
    const availHeight = Number(s?.availHeight) || Number(s?.height) || 720
    return { availWidth, availHeight }
  } catch {
    return { availWidth: 1280, availHeight: 720 }
  }
}

function browserOpenFeatures(placement: SocialWindowPlacement): string {
  return [
    `width=${placement.width}`,
    `height=${placement.height}`,
    `left=${placement.x}`,
    `top=${placement.y}`,
    'menubar=no',
    'toolbar=no',
    'location=no',
    'status=no',
    'resizable=yes',
  ].join(',')
}

/**
 * Open (or focus) the stay-on-top Friends companion as a compact bottom-right popup.
 * Requires the user to be logged into the Oneirodex site in that webview once.
 * Does not require companion API Connect — Friends uses the site session.
 * Heartbeat/offline gating does not block open; only a missing Server URL does.
 *
 * Windows: uses `screen.avail*` so the taskbar is respected; multi-monitor
 * placement follows the monitor that hosts the main companion webview.
 * Existing windows keep their user-moved position on focus (Steam-like).
 */
export async function openSocialCompanionWindow(
  baseUrl: string,
): Promise<'opened' | 'focused' | 'browser'> {
  const url = buildSocialCompanionUrl(baseUrl)
  if (!url) {
    throw new Error('Set Server URL first, then open Friends.')
  }

  const { availWidth, availHeight } = readScreenWorkArea()
  const placement = resolveBottomRightPlacement(availWidth, availHeight)

  if (!isTauriRuntime()) {
    window.open(url, 'od-social-companion', browserOpenFeatures(placement))
    return 'browser'
  }

  const existing = await WebviewWindow.getByLabel(SOCIAL_LABEL)
  if (existing) {
    if (lastSocialUrl && lastSocialUrl !== url) {
      // Server URL changed — recreate so SSE / site session hit the new origin.
      try {
        await existing.close()
      } catch {
        // fall through to create; stale label may still fail create
      }
    } else {
      await existing.show()
      await existing.setFocus()
      try {
        await existing.setAlwaysOnTop(true)
      } catch {
        // optional capability on some hosts
      }
      lastSocialUrl = url
      return 'focused'
    }
  }

  const webview = new WebviewWindow(SOCIAL_LABEL, {
    url,
    title: 'Oneirodex Friends',
    width: placement.width,
    height: placement.height,
    x: placement.x,
    y: placement.y,
    minWidth: SOCIAL_POPUP.minWidth,
    minHeight: SOCIAL_POPUP.minHeight,
    resizable: true,
    focus: true,
    alwaysOnTop: true,
    // Keep decorations so Windows users get a normal title bar + close.
    decorations: true,
    // Stay visible in the taskbar for findability; still always-on-top.
    skipTaskbar: false,
  })

  await new Promise<void>((resolve, reject) => {
    webview.once('tauri://created', () => resolve())
    webview.once('tauri://error', (event) => {
      const message = String((event as { payload?: string }).payload || 'Failed to open friends window')
      console.error('[friends]', message, event)
      reject(new Error(message))
    })
  })

  lastSocialUrl = url
  return 'opened'
}
