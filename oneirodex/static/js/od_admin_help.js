/* Extracted from the matching Jinja template so the page has no inline
 * <script>. Lives under static/js, not a theme copy — no Reset Themes. */
document.addEventListener('DOMContentLoaded', function () {
  'use strict'

  var QUICK_NAV = [
    { href: '#system-overview', label: 'System Overview' },
    { href: '#library-management', label: 'Library Management' },
    { href: '#user-management', label: 'User Management' },
    { href: '#scanning', label: 'Scanning' },
    { href: '#email-settings', label: 'Email & SMTP' },
    { href: '#maintenance', label: 'Maintenance' },
  ]

  function openSection(sectionId) {
    var section = document.getElementById(sectionId)
    if (!section) return
    var content = section.querySelector('.collapsible-content')
    var icon = section.querySelector('.collapse-icon')
    if (content) content.style.display = 'block'
    if (icon) icon.classList.remove('collapsed')
  }

  function handleHashChange() {
    var hash = window.location.hash.slice(1)
    if (hash) openSection(hash)
  }

  window.addEventListener('hashchange', handleHashChange)
  if (window.location.hash) handleHashChange()

  document.querySelectorAll('.admin-section h2').forEach(function (header) {
    header.addEventListener('click', function () {
      var section = this.closest('.admin-section')
      if (!section) return
      var content = section.querySelector('.collapsible-content')
      var icon = this.querySelector('.collapse-icon')
      if (!content) return
      if (content.style.display === 'none') {
        content.style.display = 'block'
        if (icon) icon.classList.remove('collapsed')
      } else {
        content.style.display = 'none'
        if (icon) icon.classList.add('collapsed')
      }
    })
  })

  // Collapse all sections except Quick Start Guide by default.
  document.querySelectorAll('.admin-section').forEach(function (section) {
    if (section.id === 'quick-start') return
    var content = section.querySelector('.collapsible-content')
    var icon = section.querySelector('.collapse-icon')
    if (content) content.style.display = 'none'
    if (icon) icon.classList.add('collapsed')
  })

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
        if (id) openSection(id)
      })
      group.appendChild(a)
    })
    slot.appendChild(group)
  }
})
