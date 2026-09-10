import { useEffect, useState } from 'react'
import { PageStatus } from '@oneirodex/ui'
import { getJson } from '../api/adminApi'
import { Page } from '../components/Page'
import { INTEGRATION_CARDS } from '../components/navConfig'

const INVENTORY_CATEGORY_ORDER = [
  'metadata',
  'artwork',
  'email',
  'auth',
  'support',
  'social',
  'rtc',
  'acquire',
  'ownership',
]

const INVENTORY_CATEGORY_LABELS = {
  metadata: 'Metadata',
  artwork: 'Artwork',
  email: 'Email',
  auth: 'Auth / SSO',
  support: 'Support',
  social: 'Social',
  rtc: 'Voice / RTC',
  acquire: 'Acquire',
  ownership: 'Ownership',
}

function groupInventoryByCategory(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = row.category || 'other'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const ordered = INVENTORY_CATEGORY_ORDER.filter((id) => groups.has(id)).map((id) => ({
    id,
    label: INVENTORY_CATEGORY_LABELS[id] || id,
    rows: groups.get(id),
  }))
  for (const [id, groupRows] of groups) {
    if (!INVENTORY_CATEGORY_ORDER.includes(id)) {
      ordered.push({ id, label: INVENTORY_CATEGORY_LABELS[id] || id, rows: groupRows })
    }
  }
  return ordered
}

function inventoryHref(row) {
  return row.settings_href || row.admin_href || '/admin/integrations'
}

export function IntegrationsPage() {
  const [inventory, setInventory] = useState(null)
  const [inventoryError, setInventoryError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    getJson('/api/admin/integrations/inventory')
      .then((data) => {
        if (!controller.signal.aborted) {
          setInventory(Array.isArray(data?.integrations) ? data.integrations : [])
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setInventoryError(true)
        }
      })
    return () => controller.abort()
  }, [])

  const inventoryGroups = inventory ? groupInventoryByCategory(inventory) : []

  return (
    <Page
      title="Integrations"
      lede="All providers in one place — metadata, artwork, mail, SSO, voice, acquire, ownership, and export packs. Classic Jinja forms stay behind these deep links."
    >
      {/* Rows, not a card grid (UX-C11): providers carry wildly different link
          counts, so an even grid left tall gaps beside the short ones. Same
          dense treatment as Settings / Libraries. */}
      <div className="od-admin-panel od-provider-list">
        {INTEGRATION_CARDS.map((card) => (
          // id={card.id} is the anchor the nav actually links to. Every
          // `/admin/integrations#<id>` link in navConfig was dead because the
          // only id on the page was the heading's `int-<id>`, which nothing
          // links to — so all nine deep links landed at the top of the page
          // and looked like they did nothing (W27-A8). The heading keeps its
          // prefixed id for aria-labelledby, which needs to stay unique.
          <section
            key={card.id}
            id={card.id}
            className="od-provider-row"
            aria-labelledby={`int-${card.id}`}
          >
            <div className="od-provider-row__head">
              <h2 id={`int-${card.id}`} className="od-provider-row__title">
                <a href={card.href}>{card.title}</a>
              </h2>
              <p className="od-provider-row__blurb">{card.blurb}</p>
            </div>
            <ul className="od-provider-row__links">
              {(card.links || []).map((link) => (
                <li key={`${link.href}-${link.label}`}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {!inventory && !inventoryError ? (
        <div className="od-admin-panel od-admin-inventory od-admin-panel--stacked">
          <PageStatus loading loadingMessage="Loading provider inventory…" />
        </div>
      ) : null}

      {inventory && inventory.length > 0 ? (
        <div className="od-admin-panel od-admin-inventory od-admin-panel--stacked">
          <h2>Provider inventory</h2>
          <p>
            Live status from <code>GET /api/admin/integrations/inventory</code> — every provider
            with a deep link (not IGDB-only).
          </p>
          {inventoryGroups.map((group) => (
            <div key={group.id} className="od-admin-inventory__group">
              <h3 className="od-admin-inventory__category">{group.label}</h3>
              <ul className="od-admin-inventory__list" aria-label={`${group.label} integrations`}>
                {group.rows.map((row) => (
                  <li key={row.id || row.name}>
                    <a href={inventoryHref(row)}>{row.name}</a>
                    {' — '}
                    <span className="od-admin-inventory__status">
                      {row.status || (row.configured ? 'configured' : 'available')}
                    </span>
                    {row.notes ? (
                      <span className="od-admin-inventory__notes"> · {row.notes}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {inventory && inventory.length === 0 && !inventoryError ? (
        <div className="od-admin-panel od-admin-panel--stacked">
          <p>Provider inventory returned no rows — use the cards above.</p>
        </div>
      ) : null}

      {inventoryError ? (
        <div className="od-admin-panel od-admin-panel--stacked">
          <PageStatus emptyMessage="Provider inventory unavailable — use the cards above." />
        </div>
      ) : null}

      <div className="od-admin-panel od-admin-panel--stacked">
        <p>
          Full Integrations tabs (SMTP · IGDB · community · artwork · ownership · OIDC · indexers)
          still render when Jinja content is present. This React hub is the fallback chrome when the
          classic body is empty. Member Systems also lists export packs under a secondary{' '}
          <strong>Export packs</strong> section (not buried in the page intro).
        </p>
      </div>
    </Page>
  )
}
