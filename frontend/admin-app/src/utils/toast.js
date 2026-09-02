import {
  isStackableTone,
  planToastStack,
  stackSummaryMessage,
} from '../../../shared/toastStack'

/**
 * Lightweight aurora toast — mirrors member-app showToast (top-right, dismissible).
 */

function toastHost() {
  let host = document.getElementById('od-toast-host')
  if (!host) {
    host = document.createElement('div')
    host.id = 'od-toast-host'
    host.className = 'od-toast-host'
    host.setAttribute('aria-live', 'polite')
    document.body.appendChild(host)
  }
  return host
}

function visibleStackable(host) {
  return [...host.children].filter(
    (el) =>
      !el.classList.contains('od-toast--out') &&
      (el.classList.contains('od-toast--info') || el.classList.contains('od-toast--success')),
  )
}

function stackCountOf(el) {
  const n = Number(el.dataset.toastCount)
  return Number.isFinite(n) && n > 0 ? n : 1
}

function bindToastLifecycle(el, host) {
  let removeTimer = 0
  let outTimer = 0

  const remove = () => {
    window.clearTimeout(removeTimer)
    window.clearTimeout(outTimer)
    el.classList.add('od-toast--out')
    outTimer = window.setTimeout(() => {
      el.remove()
      if (host && !host.childElementCount) {
        host.remove()
      }
    }, 220)
  }

  const abort = () => {
    window.clearTimeout(removeTimer)
    window.clearTimeout(outTimer)
  }

  const restart = () => {
    abort()
    el.classList.remove('od-toast--out')
    removeTimer = window.setTimeout(remove, 3200)
  }

  el._gtAbort = abort
  el._gtRestart = restart
  el._gtDismiss = remove
  removeTimer = window.setTimeout(remove, 3200)
  return remove
}

function paintToast(host, message, safeTone, { count, stacked } = {}) {
  const el = document.createElement('div')
  el.className = `od-toast od-toast--${safeTone}`
  if (stacked) {
    el.dataset.toastStack = '1'
    el.dataset.toastCount = String(count)
  }

  const text = document.createElement('span')
  text.className = 'od-toast__text'
  text.textContent = String(message)
  el.appendChild(text)

  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'od-toast__close'
  close.setAttribute('aria-label', 'Dismiss notification')
  close.textContent = '×'
  el.appendChild(close)

  host.appendChild(el)
  const dismiss = bindToastLifecycle(el, host)
  close.addEventListener('click', dismiss)
  return dismiss
}

export function showToast(message, tone = 'info', options = {}) {
  if (typeof document === 'undefined' || !message) {
    return
  }

  const host = toastHost()
  const safeTone = ['info', 'success', 'error', 'warn'].includes(tone) ? tone : 'info'
  const incomingCount = Number(options.count) > 0 ? Number(options.count) : 1

  if (isStackableTone(safeTone)) {
    const stacked = visibleStackable(host)
    const summary = stacked.find((el) => el.dataset.toastStack === '1')
    const stackedCount = stacked.reduce((sum, el) => sum + stackCountOf(el), 0)
    const plan = planToastStack({
      stackedCount,
      hasSummary: Boolean(summary),
      incomingCount,
    })
    if (plan.action === 'increment-summary' && summary) {
      const next = stackCountOf(summary) + incomingCount
      summary.dataset.toastCount = String(next)
      const text = summary.querySelector('.od-toast__text')
      if (text) {
        text.textContent = stackSummaryMessage(next)
      }
      summary._gtRestart?.()
      return summary._gtDismiss
    }
    if (plan.action === 'collapse') {
      for (const el of stacked) {
        el._gtAbort?.()
        el.remove()
      }
      return paintToast(host, stackSummaryMessage(plan.nextCount), safeTone, {
        count: plan.nextCount,
        stacked: true,
      })
    }
  }

  const asStack = incomingCount > 1
  return paintToast(
    host,
    asStack ? stackSummaryMessage(incomingCount) : message,
    safeTone,
    asStack ? { count: incomingCount, stacked: true } : {},
  )
}
