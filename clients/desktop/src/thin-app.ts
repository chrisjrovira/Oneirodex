import { WebviewWindow } from '@tauri-apps/api/webviewWindow'

import { normalizeBaseUrl } from './auth.js'
import { isTauriRuntime, loadStoredConfig, saveStoredConfig } from './config-store.js'
import { keychainAdapter } from './keychain.js'
import { joinUrl } from './paths.js'
import { openSocialCompanionWindow } from './social-window.js'

const LIBRARY_LABEL = 'library'

function joinLibraryUrl(baseUrl: string): string {
  return joinUrl(baseUrl.trim(), '/')
}

async function openLibraryWindow(baseUrl: string): Promise<'opened' | 'focused' | 'browser'> {
  const url = joinLibraryUrl(baseUrl)
  if (!url) {
    throw new Error('Set Server URL first.')
  }
  if (!isTauriRuntime()) {
    window.open(url, 'gt-thin-library', 'width=1280,height=800')
    return 'browser'
  }
  const existing = await WebviewWindow.getByLabel(LIBRARY_LABEL)
  if (existing) {
    await existing.show()
    await existing.setFocus()
    return 'focused'
  }
  const webview = new WebviewWindow(LIBRARY_LABEL, {
    url,
    title: 'GameTheca Library',
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    resizable: true,
    focus: true,
  })
  await new Promise<void>((resolve, reject) => {
    webview.once('tauri://created', () => resolve())
    webview.once('tauri://error', (event) => {
      reject(new Error(String((event as { payload?: string }).payload || 'Failed to open library window')))
    })
  })
  return 'opened'
}

/**
 * Thin client shell — connect-only. No download/install/launch.
 * Opens member SPA + Friends in least-privilege webviews.
 */
export async function mountThinApp(root: HTMLElement): Promise<void> {
  root.innerHTML = `
    <header class="header">
      <h1>GameTheca Thin</h1>
      <p class="tagline">Browse, social &amp; browser play — no local install pipeline</p>
    </header>
    <section class="connect panel">
      <label>Server URL <input id="baseUrl" type="url" placeholder="https://games.example.com" autocomplete="url" /></label>
      <p class="hint">Sign in with your site account inside the library / friends windows. API token optional for presence only.</p>
      <label>Thin API token (optional) <input id="token" type="password" placeholder="gt_… thin preset" autocomplete="off" /></label>
      <div class="actions">
        <button type="button" id="saveBtn">Save</button>
        <button type="button" id="openLibraryBtn" class="primary">Open library</button>
        <button type="button" id="openFriendsBtn">Open friends</button>
      </div>
      <p id="status" class="status" data-tone="info">Enter your GameTheca URL to begin.</p>
    </section>
    <section class="panel honesty">
      <h2>What this client does</h2>
      <ul>
        <li>Opens your household library in a dedicated window</li>
        <li>Friends companion (always-on-top)</li>
        <li>Uses thin device capabilities (no download / install / native play)</li>
      </ul>
      <p class="hint">Need Install / Update / Play for PC titles? Use the full <strong>GameTheca</strong> desktop companion.</p>
    </section>
  `

  const baseUrlEl = root.querySelector<HTMLInputElement>('#baseUrl')!
  const tokenEl = root.querySelector<HTMLInputElement>('#token')!
  const statusEl = root.querySelector<HTMLParagraphElement>('#status')!
  const setStatus = (message: string, tone: 'info' | 'error' | 'success' = 'info') => {
    statusEl.textContent = message
    statusEl.dataset.tone = tone
  }

  async function persistThinConfig(baseUrl: string, token: string): Promise<void> {
    // Config JSON never stores the token; optional thin token lives in the OS keyring.
    await saveStoredConfig({ baseUrl, token: null })
    if (token) {
      await keychainAdapter.save(token)
    } else {
      await keychainAdapter.clear()
    }
  }

  try {
    const stored = await loadStoredConfig()
    if (stored.baseUrl) baseUrlEl.value = stored.baseUrl
    const fromKeychain = await keychainAdapter.load()
    const token = stored.token || fromKeychain
    if (token) tokenEl.value = token
  } catch {
    // first run
  }

  root.querySelector('#saveBtn')!.addEventListener('click', () => {
    void (async () => {
      try {
        const baseUrl = normalizeBaseUrl(baseUrlEl.value)
        baseUrlEl.value = baseUrl
        await persistThinConfig(baseUrl, tokenEl.value.trim())
        setStatus('Saved. Open library or friends when ready.', 'success')
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), 'error')
      }
    })()
  })

  root.querySelector('#openLibraryBtn')!.addEventListener('click', () => {
    void (async () => {
      try {
        const baseUrl = normalizeBaseUrl(baseUrlEl.value)
        baseUrlEl.value = baseUrl
        await persistThinConfig(baseUrl, tokenEl.value.trim())
        const result = await openLibraryWindow(baseUrl)
        setStatus(
          result === 'focused' ? 'Library window focused.' : 'Library window opened — sign in if prompted.',
          'success',
        )
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), 'error')
      }
    })()
  })

  root.querySelector('#openFriendsBtn')!.addEventListener('click', () => {
    void (async () => {
      try {
        const baseUrl = normalizeBaseUrl(baseUrlEl.value)
        baseUrlEl.value = baseUrl
        await persistThinConfig(baseUrl, tokenEl.value.trim())
        const result = await openSocialCompanionWindow(baseUrl)
        setStatus(
          result === 'focused' ? 'Friends window focused.' : 'Friends window opened — sign in if prompted.',
          'success',
        )
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), 'error')
      }
    })()
  })
}
