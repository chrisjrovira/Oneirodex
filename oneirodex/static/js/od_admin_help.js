/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes.
 *
 * The page is <details>/<summary> now: the browser owns open/close, so this
 * only has two jobs — put the quick-nav group in the thin top bar, and make a
 * deep link (/admin/help#scanning) open the target section before it scrolls.
 */
document.addEventListener('DOMContentLoaded', function () {
  'use strict'

  var QUICK_NAV = [
    { href: '#quick-start', label: 'Quick Start' },
    { href: '#system-overview', label: 'System Overview' },
    { href: '#library-management', label: 'Library Management' },
    { href: '#user-management', label: 'User Management' },
    { href: '#scanning', label: 'Scanning' },
    { href: '#email-settings', label: 'Email & SMTP' },
    { href: '#maintenance', label: 'Maintenance' },
  ]

  function openSection(sectionId, scroll) {
    var section = document.getElementById(sectionId)
    if (!section) return
    if (typeof section.open === 'boolean') section.open = true
    if (scroll) section.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  function handleHashChange() {
    var hash = window.location.hash.slice(1)
    if (hash) openSection(hash, true)
  }

  window.addEventListener('hashchange', handleHashChange)
  if (window.location.hash) handleHashChange()

  // Quick Navigation lives in the thin top bar (centre slot), not as an
  // in-page panel — same constant as other admin page actions.
  var slot = document.getElementById('od-admin-topbar-slot')
  if (slot && !slot.querySelector('[data-help-quick-nav]')) {
    var group = document.createElement('div')
    group.className = 'od-cbtn-group'
    group.setAttribute('role', 'group')
    group.setAttribute('aria-label', 'Help sections')
    group.setAttribute('data-help-quick-nav', '1')
    QUICK_NAV.forEach(function (item) {
      var a = document.createElement('a')
      a.className = 'od-btn'
      a.href = item.href
      a.textContent = item.label
      a.addEventListener('click', function () {
        var id = item.href.replace(/^#/, '')
        if (id) openSection(id, false)
      })
      group.appendChild(a)
    })
    slot.appendChild(group)
  }
})
