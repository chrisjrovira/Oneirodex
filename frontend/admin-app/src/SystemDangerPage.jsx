import { AdminPageActions } from './AdminPageActions'
import { SystemResetPanel } from './SystemResetPanel'

/**
 * System → Danger zone.
 *
 * Lives off the Ops glance on purpose: a control that empties database scopes
 * should not sit under the daily observability widgets. Operators reach it from
 * the System rail subsection, after reading the gates on the panel itself.
 */
export function SystemDangerPage() {
  return (
    <div className="od-admin-page od-system-danger">
      <AdminPageActions label="Danger zone" slot="trail">
        <a className="od-cbtn" href="/admin/ops">
          Back to Ops
        </a>
      </AdminPageActions>

      <h1>Danger zone</h1>
      <p className="od-admin-lede">
        Scoped factory reset for this Oneirodex install. Nothing here deletes
        game files on disk — only database state you choose. Confirmations are
        required before anything runs.
      </p>

      <SystemResetPanel />
    </div>
  )
}
