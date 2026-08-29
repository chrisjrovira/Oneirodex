import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { EmulatorFirmwarePanel } from './EmulatorFirmwarePanel'
import { BrowserPlayerPilot } from './BrowserPlayerPilot'
import { ImportLeafLibraries } from './ImportLeafLibraries'
import { ProposeLeafLibraries } from './ProposeLeafLibraries'
import './styles.css'

const root = document.getElementById('admin-app-root')
if (root) {
  createRoot(root).render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  )
}

// Hybrid Jinja surfaces (e.g. Library tools → Propose leaf tab) mount the
// same confirm UI beside legacy content when App skips the SPA main.
const proposeLeafMount = document.getElementById('propose-leaf-mount')
if (proposeLeafMount && !proposeLeafMount.dataset.reactMounted) {
  proposeLeafMount.dataset.reactMounted = '1'
  createRoot(proposeLeafMount).render(<ProposeLeafLibraries />)
}

const importLeafMount = document.getElementById('import-leaf-mount')
if (importLeafMount && !importLeafMount.dataset.reactMounted) {
  importLeafMount.dataset.reactMounted = '1'
  createRoot(importLeafMount).render(<ImportLeafLibraries />)
}

// Emulators page keeps its Jinja profile forms; firmware is the React island
// (GT-B2 / UID-007) so the page did not have to be migrated wholesale.
const firmwareMount = document.getElementById('emulator-firmware-mount')
if (firmwareMount && !firmwareMount.dataset.reactMounted) {
  firmwareMount.dataset.reactMounted = '1'
  createRoot(firmwareMount).render(
    <>
      <BrowserPlayerPilot />
      <EmulatorFirmwarePanel />
    </>,
  )
}
