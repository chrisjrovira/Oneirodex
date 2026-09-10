import { useState } from 'react'
import { Button } from '@oneirodex/ui'
import { csrfHeaders } from '../api/adminApi'
import { Page } from '../components/Page'
import { showToast } from '../utils/toast'

export function ThemesPage() {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function resetThemes() {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/admin/themes/reset', {
        method: 'POST',
        credentials: 'same-origin',
        headers: csrfHeaders({ 'Content-Type': 'application/json' }),
        body: '{}',
      })
      // Reset Themes is the action operators are told to run after every theme
      // CSS change, and it gave no feedback outside a small inline line.
      const ok = response.ok
      // No hard-refresh step: `theme_asset` versions each URL by mtime+size and
      // a reset clears the memo, so replaced bytes come back on a normal reload.
      // See docs/admin/themes-reset.md.
      setMessage(ok ? 'Default themes reset. Reload to see them.' : 'Reset failed.')
      showToast(
        ok ? 'Default themes reset — reload to pick them up.' : 'Theme reset failed.',
        ok ? 'success' : 'error',
      )
    } catch {
      setMessage('Reset failed.')
      showToast('Theme reset failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title="Themes" lede="Reset default CSS after a deploy. Pick a look in Preferences.">
      <div className="od-admin-actions-row">
        <Button disabled={busy} onClick={resetThemes}>
          Reset Default Themes
        </Button>
        <a className="od-btn" href="/admin/themes/readme">
          Theme authoring readme
        </a>
      </div>
      {message ? <p>{message}</p> : null}
      <div className="od-admin-panel">
        <p>
          After Unraid <code>build --no-cache</code>, run Reset Default Themes once so{' '}
          <code>od-tokens.css</code> (green accent, glass) syncs onto the library volume.
        </p>
      </div>
    </Page>
  )
}
