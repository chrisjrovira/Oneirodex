import { useEffect } from 'react'

/**
 * Put the admin shell grid on <body> (GT-B2).
 *
 * The rail and the page content are in sibling DOM trees (#admin-app-root and
 * #admin-legacy-content), so the nearest element that contains both is the
 * body. React cannot render a wrapper around them without restructuring
 * base_admin.html and breaking the legacy/spa render-mode split, so the grid
 * host is set imperatively here instead.
 *
 * Density is set here too. Admin used to force `compact` on the whole body, on
 * the reasoning that admin is the dense half of the product. The cost was that
 * `--od-control-h` dropped from 2.25rem to 1.85rem for every control on the
 * surface, so admin buttons were visibly shorter than the identical `.od-btn`
 * beside them in the member app — the two halves shared a stylesheet and still
 * did not match. Chrome parity is worth more than the ~6px: admin now takes the
 * same default as member, and a genuinely dense region (a long table) opts
 * itself back in with its own `data-density="compact"`, which is what the
 * attribute was designed for and is still supported here.
 */
export function useAdminShellFrame(railState) {
  useEffect(() => {
    const { body } = document
    body.classList.add('od-shell-host')
    // Only set density if nothing upstream already chose one, so a template can
    // override without this effect fighting it on every render.
    if (!body.dataset.density) body.dataset.density = 'comfortable'

    return () => {
      body.classList.remove('od-shell-host')
      delete body.dataset.rail
    }
  }, [])

  useEffect(() => {
    document.body.dataset.rail = railState
  }, [railState])
}
