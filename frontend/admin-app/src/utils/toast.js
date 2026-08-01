/**
 * Lightweight aurora toast — mirrors member-app showToast (top-right, auto-dismiss).
 * @param {string} message
 * @param {'info'|'success'|'error'|'warn'} [tone]
 */
export function showToast(message, tone = 'info') {
  if (typeof document === 'undefined' || !message) {
    return
  }

  let host = document.getElementById('gt-toast-host')
  if (!host) {
    host = document.createElement('div')
    host.id = 'gt-toast-host'
    host.className = 'gt-toast-host'
    host.setAttribute('aria-live', 'polite')
    document.body.appendChild(host)
  }

  const el = document.createElement('div')
  const safeTone = ['info', 'success', 'error', 'warn'].includes(tone) ? tone : 'info'
  el.className = `gt-toast gt-toast--${safeTone}`
  el.textContent = String(message)
  host.appendChild(el)

  window.setTimeout(() => {
    el.classList.add('gt-toast--out')
    window.setTimeout(() => {
      el.remove()
      if (host && !host.childElementCount) {
        host.remove()
      }
    }, 220)
  }, 3200)
}
