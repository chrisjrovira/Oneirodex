import { useEffect, useState } from 'react'
import { PageStatus } from '@oneirodex/ui'
import { getJson } from '../api/adminApi'
import { DataTable } from '../components/DataTable'
import { Page } from '../components/Page'

export function PluginsPage() {
  const [plugins, setPlugins] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getJson('/api/plugins')
      .then((data) => setPlugins(data.plugins || []))
      .catch(setError)
  }, [])

  return (
    <Page
      title="Plugins & connectors"
      lede="Built-in registry of metadata, acquire, emu, and export hooks."
    >
      <PageStatus error={error} errorMessage="Unable to load plugins." />
      <div className="od-admin-panel">
        {!plugins ? (
          <PageStatus loading loadingMessage="Loading plugins…" />
        ) : (
          // Category and status are exactly what someone comes here to group
          // by, so this is the table that most wanted sorting and had none.
          <DataTable
            rows={plugins}
            getRowKey={(plugin) => plugin.id}
            emptyMessage="No plugins registered."
            initialSort={{ key: 'category', dir: 'asc' }}
            dense
            columns={[
              {
                key: 'id',
                label: 'ID',
                render: (plugin) => <code>{plugin.id}</code>,
              },
              { key: 'name', label: 'Name' },
              { key: 'category', label: 'Category' },
              { key: 'status', label: 'Status' },
            ]}
          />
        )}
      </div>
    </Page>
  )
}
