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
 * Density is set here too: admin is the compact half of the product. Putting it
 * on the body rather than in the stylesheet means an individual admin page can
 * still opt a region back to comfortable with its own data-density.
 */
export function useAdminShellFrame(railState) {
  useEffect(() => {
    const { body } = document
    body.classList.add('gt-shell-host')
    // Only set density if nothing upstream already chose one, so a template can
    // override without this effect fighting it on every render.
    if (!body.dataset.density) body.dataset.density = 'compact'

    return () => {
      body.classList.remove('gt-shell-host')
      delete body.dataset.rail
    }
  }, [])

  useEffect(() => {
    document.body.dataset.rail = railState
  }, [railState])
}
