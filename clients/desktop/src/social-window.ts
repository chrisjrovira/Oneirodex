import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

import { isTauriRuntime } from './config-store.js'
import { joinUrl } from './paths.js'

const SOCIAL_LABEL = 'social'

/** Member SPA route for the stay-open Friends companion. */
export function buildSocialCompanionUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim()
  if (!trimmed) {
    return ''
  }
  return joinUrl(trimmed, '/social-companion')
}

/**
 * Open (or focus) the stay-on-top Friends companion window pointed at the member SPA.
 * Requires the user to be logged into the GameTheca site in that webview once.
 * Does not require companion API Connect — Friends uses the site session.
 */
export async function openSocialCompanionWindow(
  baseUrl: string,
): Promise<'opened' | 'focused' | 'browser'> {
  const url = buildSocialCompanionUrl(baseUrl)
  if (!url) {
    throw new Error('Set Server URL first, then open Friends.')
  }
  if (!isTauriRuntime()) {
    window.open(url, 'gt-social-companion', 'width=380,height=720')
    return 'browser'
  }

  const existing = await WebviewWindow.getByLabel(SOCIAL_LABEL)
  if (existing) {
    await existing.show()
    await existing.setFocus()
    try {
      await existing.setAlwaysOnTop(true)
    } catch {
      // optional capability on some hosts
    }
    return 'focused'
  }

  const webview = new WebviewWindow(SOCIAL_LABEL, {
    url,
    title: 'GameTheca Friends',
    width: 380,
    height: 720,
    minWidth: 320,
    minHeight: 480,
    resizable: true,
    focus: true,
    alwaysOnTop: true,
  })

  await new Promise<void>((resolve, reject) => {
    webview.once('tauri://created', () => resolve())
    webview.once('tauri://error', (event) => {
      const message = String((event as { payload?: string }).payload || 'Failed to open friends window')
      console.error('[friends]', message, event)
      reject(new Error(message))
    })
  })

  return 'opened'
}
