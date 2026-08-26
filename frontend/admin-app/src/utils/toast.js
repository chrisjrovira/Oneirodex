/**
 * Lightweight aurora toast — mirrors member-app showToast (top-right, dismissible).
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

  const text = document.createElement('span')
  text.className = 'gt-toast__text'
  text.textContent = String(message)
  el.appendChild(text)

  let removeTimer = 0
  let outTimer = 0

  const remove = () => {
    window.clearTimeout(removeTimer)
    window.clearTimeout(outTimer)
    el.classList.add('gt-toast--out')
    outTimer = window.setTimeout(() => {
      el.remove()
      if (host && !host.childElementCount) {
        host.remove()
      }
    }, 220)
  }

  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'gt-toast__close'
  close.setAttribute('aria-label', 'Dismiss notification')
  close.textContent = '×'
  close.addEventListener('click', remove)
  el.appendChild(close)

  host.appendChild(el)

  removeTimer = window.setTimeout(remove, 3200)
  return remove
}
