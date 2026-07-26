import { createAuthStore, isGamethecaToken, normalizeBaseUrl } from './auth.js'

import { createDesktopApi } from './api.js'

import { kickoffDownload, pickDownloadVersion } from './download.js'

import { kickoffInstall } from './install.js'

import { loadInstallsFromDisk } from './install-store.js'

import { canLaunchGame, kickoffLaunch } from './launch.js'

import { kickoffUninstall, kickoffUpdate } from './uninstall.js'

import { startClientHeartbeat, type HeartbeatScheduler } from './heartbeat.js'

import { fetchLibraryPreview, validateConnection } from './connect.js'

import { loadStoredConfig, saveStoredConfig } from './config-store.js'

import { keychainAdapter } from './keychain.js'

import { hydrateLifecycleRegistry, pullLifecycleRegistryFromServer, syncLifecycleRegistryToServer, type LifecycleRegistry } from './lifecycle-store.js'

import {

  canPerformAction,

  type GameLifecycleState,

  type LifecycleAction,

} from './lifecycle.js'

import type { SearchResultItem } from '@gametheca/api-client'



const auth = createAuthStore()

let lifecycle: LifecycleRegistry | null = null



let connected = false

let libraryGames: SearchResultItem[] = []

let heartbeatScheduler: HeartbeatScheduler | null = null

const gameActivity = new Map<string, string>()

const busyGames = new Set<string>()



async function ensureLifecycleRegistry(): Promise<LifecycleRegistry> {

  if (!lifecycle) {

    lifecycle = await hydrateLifecycleRegistry(auth)

  }

  return lifecycle

}



let els: {

  baseUrl: HTMLInputElement

  token: HTMLInputElement

  connectBtn: HTMLButtonElement

  status: HTMLParagraphElement

  authSummary: HTMLParagraphElement

  library: HTMLElement

  lifecyclePanel: HTMLElement

}



function setStatus(message: string, tone: 'info' | 'error' | 'success' = 'info'): void {

  els.status.textContent = message

  els.status.dataset.tone = tone

}



function setGameActivity(gameUuid: string, message: string): void {

  if (message) {

    gameActivity.set(gameUuid, message)

  } else {

    gameActivity.delete(gameUuid)

  }

}



function renderAuthSummary(): void {

  const snapshot = auth.snapshot()

  els.authSummary.textContent = snapshot.hasToken

    ? `Server: ${snapshot.baseUrl || '(not set)'} · token configured`

    : 'Not connected — enter server URL and API token.'

}



async function renderLifecyclePanel(): Promise<void> {
  const registry = lifecycle
  if (!registry) {
    return
  }

  const records = registry.snapshot()
  if (records.length === 0) {
    els.lifecyclePanel.innerHTML =
      '<p class="muted">Lifecycle states appear after you load games (all start as <code>not_downloaded</code>).</p>'
    return
  }

  let installs: Record<string, { extractPath?: string; archivePath?: string; exePath?: string | null }> = {}
  try {
    installs = await loadInstallsFromDisk()
  } catch {
    installs = {}
  }

  const nameByUuid = new Map(
    libraryGames.map((g) => [g.uuid, typeof g.name === 'string' ? g.name : g.uuid]),
  )

  const rows = records
    .map((record) => {
      const install = installs[record.gameUuid]
      const title = nameByUuid.get(record.gameUuid) || record.gameUuid
      const stateClass = record.state === 'update_available' ? 'state-update' : 'state-ok'
      const pathBit = install?.extractPath
        ? `<div class="install-path"><code>${escapeHtml(install.extractPath)}</code></div>`
        : '<div class="install-path muted">No local install path</div>'
      const exeBit = install?.exePath
        ? `<div class="install-exe muted">exe: <code>${escapeHtml(install.exePath)}</code></div>`
        : ''
      return `<li class="${stateClass}">
        <div><strong>${escapeHtml(title)}</strong> — <span class="state-pill">${escapeHtml(record.state)}</span></div>
        <div class="uuid muted"><code>${escapeHtml(record.gameUuid)}</code></div>
        ${pathBit}${exeBit}
      </li>`
    })
    .join('')

  els.lifecyclePanel.innerHTML = `<ul class="lifecycle-list">${rows}</ul>`
}

function lifecycleActionsFor(state: GameLifecycleState): LifecycleAction[] {

  const actions: LifecycleAction[] = ['download', 'install', 'update', 'uninstall']

  return actions.filter((action) => canPerformAction(state, action))

}



function renderLibrary(): void {

  const registry = lifecycle

  if (!connected) {

    els.library.innerHTML = '<p class="muted">Connect to load your library preview.</p>'

    return

  }



  if (!registry) {

    els.library.innerHTML = '<p class="muted">Loading lifecycle registry…</p>'

    return

  }



  if (libraryGames.length === 0) {

    els.library.innerHTML =

      '<p class="muted">Connected, but no games returned from search. Try another server or query later.</p>'

    renderLifecyclePanel()

    return

  }



  const cards = libraryGames

    .map((game) => {

      const uuid = game.uuid

      const name = typeof game.name === 'string' ? game.name : uuid

      const state = registry.get(uuid)

      const actions = lifecycleActionsFor(state)

      const isBusy = busyGames.has(uuid)

      const activity = gameActivity.get(uuid)

      const actionButtons = actions

        .map(

          (action) =>

            `<button type="button" class="action-btn${action === 'update' && state === 'update_available' ? ' action-btn--update' : ''}" data-action="${action}" data-uuid="${escapeHtml(uuid)}" ${isBusy ? 'disabled' : ''}>${action}</button>`,

        )

        .join('')

      const playButton = canLaunchGame(state)

        ? `<button type="button" class="action-btn play-btn" data-action="play" data-uuid="${escapeHtml(uuid)}" ${isBusy ? 'disabled' : ''}>Play</button>`

        : ''



      const activityHtml = activity

        ? `<p class="activity">${escapeHtml(activity)}</p>`

        : ''



      return `

        <article class="game-card">

          <h3>${escapeHtml(name)}</h3>

          <p class="uuid">${escapeHtml(uuid)}</p>

          <p class="state">State: <strong>${escapeHtml(state)}</strong></p>

          ${activityHtml}

          <div class="actions">${playButton}${actionButtons || (!playButton ? '<span class="muted">No actions</span>' : '')}</div>

        </article>

      `

    })

    .join('')



  els.library.innerHTML = `<div class="game-grid">${cards}</div>`

  renderLifecyclePanel()

}



function escapeHtml(value: string): string {

  return value

    .replaceAll('&', '&amp;')

    .replaceAll('<', '&lt;')

    .replaceAll('>', '&gt;')

    .replaceAll('"', '&quot;')

}



async function hydrateFromDisk(): Promise<void> {

  const stored = await loadStoredConfig()

  auth.setBaseUrl(stored.baseUrl)

  auth.setToken(stored.token)

  await auth.hydrateFromKeychain(keychainAdapter)



  els.baseUrl.value = auth.getBaseUrl()

  els.token.value = auth.getToken() ?? ''

  renderAuthSummary()

}



async function handleConnect(): Promise<void> {

  const baseUrl = normalizeBaseUrl(els.baseUrl.value)

  const token = els.token.value.trim()



  if (!baseUrl) {

    setStatus('Enter a server base URL.', 'error')

    return

  }



  if (!token || !isGamethecaToken(token)) {

    setStatus('Enter a valid GameTheca API token (gt_<prefix>_<secret>).', 'error')

    return

  }



  els.connectBtn.disabled = true

  setStatus('Connecting…', 'info')



  auth.setBaseUrl(baseUrl)

  auth.setToken(token)



  const api = createDesktopApi(auth)

  const result = await validateConnection(api)



  if (!result.ok) {

    connected = false

    libraryGames = []

    heartbeatScheduler?.stop()

    heartbeatScheduler = null

    setStatus(result.message, 'error')

    renderAuthSummary()

    renderLibrary()

    els.connectBtn.disabled = false

    return

  }



  await saveStoredConfig({ baseUrl, token })

  await auth.persistToKeychain(keychainAdapter)



  libraryGames = await fetchLibraryPreview(api)

  connected = true



  heartbeatScheduler?.stop()

  heartbeatScheduler = startClientHeartbeat(auth, {
    clientVersion: '0.0.1',
    onCommands: async (command) => {
      await runGameAction(command.action, command.game_uuid)
    },
  })

  try {
    const registry = await ensureLifecycleRegistry()
    await pullLifecycleRegistryFromServer(auth, registry)
    await syncLifecycleRegistryToServer(auth, registry.snapshot())
  } catch {
    // Lifecycle sync is best-effort after connect.
  }

  setStatus(

    `Connected (${result.collectionCount} collection${result.collectionCount === 1 ? '' : 's'}).`,

    'success',

  )

  renderAuthSummary()

  renderLibrary()

  els.connectBtn.disabled = false

}



async function runPlayAction(uuid: string): Promise<void> {

  if (!lifecycle || busyGames.has(uuid)) {

    return

  }



  busyGames.add(uuid)

  const api = createDesktopApi(auth)



  try {

    setGameActivity(uuid, 'Launching…')

    renderLibrary()

    const { pid } = await kickoffLaunch(api, uuid)

    setGameActivity(uuid, `Playing (pid ${pid})`)

    renderLibrary()

    setStatus(`Launched ${uuid}.`, 'success')

  } finally {

    busyGames.delete(uuid)

    renderLibrary()

  }

}



async function runGameAction(action: LifecycleAction, uuid: string): Promise<void> {

  const registry = lifecycle

  if (!registry || busyGames.has(uuid)) {

    return

  }



  busyGames.add(uuid)

  const api = createDesktopApi(auth)



  try {

    if (action === 'download') {

      setGameActivity(uuid, 'Downloading…')

      renderLibrary()

      const versionChoice = await pickDownloadVersion(api, uuid)

      await kickoffDownload(api, auth, registry, uuid, {

        kind: versionChoice.kind,

        versionUuid: versionChoice.versionUuid,

        onProgress: ({ bytesReceived, totalBytes }) => {

          if (totalBytes) {

            const percent = Math.round((bytesReceived / totalBytes) * 100)

            setGameActivity(uuid, `Downloading… ${percent}%`)

          } else {

            setGameActivity(uuid, `Downloading… ${bytesReceived} bytes`)

          }

          renderLibrary()

        },

      })

      setStatus(`Downloaded ${uuid}.`, 'success')

    } else if (action === 'install') {

      setGameActivity(uuid, 'Extracting…')

      renderLibrary()

      await kickoffInstall(registry, uuid)

      setStatus(`Installed ${uuid}.`, 'success')

    } else if (action === 'update') {

      setGameActivity(uuid, 'Updating…')

      renderLibrary()

      await kickoffUpdate(api, auth, registry, uuid, {

        onProgress: ({ bytesReceived, totalBytes }) => {

          if (totalBytes) {

            const percent = Math.round((bytesReceived / totalBytes) * 100)

            setGameActivity(uuid, `Updating… ${percent}%`)

          } else {

            setGameActivity(uuid, `Updating… ${bytesReceived} bytes`)

          }

          renderLibrary()

        },

      })

      setStatus(`Updated ${uuid}.`, 'success')

    } else if (action === 'uninstall') {

      setGameActivity(uuid, 'Removing local files…')

      renderLibrary()

      await kickoffUninstall(registry, uuid)

      setStatus(`Uninstalled ${uuid}.`, 'success')

    }

  } finally {

    busyGames.delete(uuid)

    setGameActivity(uuid, '')

    renderLibrary()

  }

}



function handleLibraryClick(event: Event): void {

  const target = event.target

  if (!(target instanceof HTMLButtonElement)) {

    return

  }



  const action = target.dataset.action

  const uuid = target.dataset.uuid

  if (!action || !uuid || !lifecycle) {

    return

  }



  if (action === 'play') {

    void (async () => {

      try {

        await runPlayAction(uuid)

      } catch (error) {

        const message = error instanceof Error ? error.message : 'Launch failed'

        setGameActivity(uuid, `Error: ${message}`)

        renderLibrary()

        setStatus(message, 'error')

      }

    })()

    return

  }



  if (

    action !== 'download' &&

    action !== 'install' &&

    action !== 'update' &&

    action !== 'uninstall'

  ) {

    return

  }



  void (async () => {

    try {

      await runGameAction(action, uuid)

    } catch (error) {

      const message = error instanceof Error ? error.message : 'Lifecycle action failed'

      setGameActivity(uuid, `Error: ${message}`)

      renderLibrary()

      setStatus(message, 'error')

    }

  })()

}



function bindElements(root: HTMLElement): void {

  els = {

    baseUrl: root.querySelector('#base-url')!,

    token: root.querySelector('#token')!,

    connectBtn: root.querySelector('#connect-btn')!,

    status: root.querySelector('#status')!,

    authSummary: root.querySelector('#auth-summary')!,

    library: root.querySelector('#library')!,

    lifecyclePanel: root.querySelector('#lifecycle-panel')!,

  }

}



export async function mountApp(root: HTMLElement): Promise<void> {

  root.innerHTML = `

    <main class="shell">

      <header>

        <h1>GameTheca Desktop</h1>

        <p class="muted">Connect to your server, preview library, and track local install state.</p>

      </header>



      <section class="panel">

        <h2>Connection</h2>

        <p id="auth-summary" class="muted"></p>

        <form id="connect-form" class="connect-form">

          <label>

            Server URL

            <input id="base-url" name="baseUrl" type="url" placeholder="https://gametheca.example.com" autocomplete="url" />

          </label>

          <label>

            API token

            <input id="token" name="token" type="password" placeholder="gt_prefix_secret" autocomplete="off" />

          </label>

          <button id="connect-btn" type="submit">Connect</button>

        </form>

        <p id="status" class="status" data-tone="info"></p>

      </section>



      <section class="panel">

        <h2>Library preview</h2>

        <div id="library"></div>

      </section>



      <section class="panel">

        <h2>Lifecycle registry</h2>

        <div id="lifecycle-panel"></div>

      </section>

    </main>

  `



  bindElements(root)



  root.querySelector('#connect-form')!.addEventListener('submit', (event) => {

    event.preventDefault()

    void handleConnect()

  })



  els.library.addEventListener('click', handleLibraryClick)



  await ensureLifecycleRegistry()

  await hydrateFromDisk()

  renderLibrary()

  setStatus('Enter credentials and click Connect.', 'info')

}


