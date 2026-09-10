/**
 * Best-effort human string from an unknown thrown value.
 *
 * `strict` makes a `catch` binding `unknown`, but the admin SPA is full of the
 * `err?.message || 'fallback'` idiom written when `err` was implicitly `any`.
 * This keeps that behaviour exactly — an `Error` (or any `{ message: string }`)
 * yields its message, anything else yields `''` so the caller's `|| fallback`
 * still fires — without scattering casts at every call site.
 */
export function errorText(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return ''
}
