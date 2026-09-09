import { forwardRef } from 'react'

/**
 * `<Button>` — one element for the class-by-convention `.od-btn` family.
 *
 * Buttons across the SPAs were plain `<button className="od-btn od-btn--primary">`
 * markup: correct, but hand-assembled at ~27 call sites, and one missed class is
 * exactly the defect `buttonLanguage.test.js` exists to catch. This wraps the
 * convention so a call site names intent (`variant` / `size`) instead of
 * spelling classes, and always emits `od-btn`.
 *
 * No new CSS: every variant maps onto a class already in the shared theme
 * (`oneirodex/setup/default_theme/css/od-primitives.css`):
 *
 *   default → `.od-btn`            (no modifier)
 *   primary → `.od-btn--primary`
 *   danger  → `.od-btn--danger`
 *   ghost   → `.od-btn--ghost`
 *   size sm → `.od-btn--sm`   ·   size md → no modifier
 *
 * `type` defaults to `"button"` so a `<Button>` dropped into a form does not
 * submit it — pass `type="submit"` explicitly for the submit control.
 *
 * `className` is merged AFTER the computed classes so a call site can still add
 * a layout / one-off hook without losing the base classes.
 */

const VARIANT_CLASS = {
  default: '',
  primary: 'od-btn--primary',
  danger: 'od-btn--danger',
  ghost: 'od-btn--ghost',
}

export const Button = forwardRef(function Button(
  { variant = 'default', size = 'md', type = 'button', className = '', children, ...rest },
  ref,
) {
  const classes = [
    'od-btn',
    VARIANT_CLASS[variant] ?? '',
    size === 'sm' ? 'od-btn--sm' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button ref={ref} type={type} className={classes} {...rest}>
      {children}
    </button>
  )
})

export default Button
