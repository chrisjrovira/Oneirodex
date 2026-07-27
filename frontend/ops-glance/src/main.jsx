import { createRoot } from 'react-dom/client'
import { OpsApp } from './OpsApp'
/* Local CSS so Docker Node stage can build without the Flask theme tree. */
import './ops-glance.css'

const rootElement = document.getElementById('ops-glance-root')
if (rootElement) {
  const pollMs = Number.parseInt(rootElement.dataset.pollMs, 10)
  const enableServerStatus = rootElement.dataset.enableServerStatus === 'true'

  createRoot(rootElement).render(
    <OpsApp
      pollMs={Number.isFinite(pollMs) && pollMs > 0 ? pollMs : 15000}
      enableServerStatus={enableServerStatus}
    />,
  )
}
