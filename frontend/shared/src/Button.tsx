import { forwardRef, type ButtonHTMLAttributes } from 'react'

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
 *   default   → `.od-btn`            (no modifier)
 *   primary   → `.od-btn--primary`
 *   secondary → `.od-btn--secondary`
 *   danger    → `.od-btn--danger`
 *   ghost     → `.od-btn--ghost`
 *   quiet     → `.od-btn--quiet`
 *   size sm → `.od-btn--sm`   ·   size md → no modifier   ·   size lg → `.od-btn--lg`
 *   pill    → `.od-btn--pill`
 *
 * `od-btn--accent` is admin-only CSS (`admin-app/src/ops.css`), not a theme
 * class, so it stays a `className` pass-through rather than a variant.
 *
 * `type` defaults to `"button"` so a `<Button>` dropped into a form does not
 * submit it — pass `type="submit"` explicitly for the submit control.
 *
 * `className` is merged AFTER the computed classes so a call site can still add
 * a layout / one-off hook without losing the base classes.
 */

export type ButtonVariant = 'default' | 'primary' | 'secondary' | 'danger' | 'ghost' | 'quiet'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** `.od-btn--pill` — fully rounded ends. */
  pill?: boolean
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: '',
  primary: 'od-btn--primary',
  secondary: 'od-btn--secondary',
  danger: 'od-btn--danger',
  ghost: 'od-btn--ghost',
  quiet: 'od-btn--quiet',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'default',
    size = 'md',
    pill = false,
    type = 'button',
    className = '',
    children,
    ...rest
  },
  ref,
) {
  const classes = [
    'od-btn',
    VARIANT_CLASS[variant] ?? '',
    size === 'sm' ? 'od-btn--sm' : size === 'lg' ? 'od-btn--lg' : '',
    pill ? 'od-btn--pill' : '',
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
