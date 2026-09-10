/**
 * Password-manager opt-out attributes.
 *
 * Bitwarden / 1Password / LastPass browser extensions walk the DOM for input
 * fields, inject an inline overlay icon positioned with getBoundingClientRect,
 * and re-run that scan on every mutation. On admin pages that also poll and
 * re-render (Dashboard, Ops, Scans) or carry a wide filterable table (Users),
 * that scan + reposition on each tick is a measurable main-thread stall — the
 * "admin freezes with Bitwarden" report.
 *
 * These are the documented opt-outs each extension honours. Spread onto any
 * admin field that is not a real credential entry, and set
 * `data-form-type="other"` on the surrounding <form> so the whole form is
 * skipped rather than field-by-field.
 *
 *   <input className="od-admin-input" {...PM_IGNORE} />
 *   <form className="od-admin-panel" data-form-type="other">
 *
 * The one genuine credential form (CreateUserForm's password field) still gets
 * them: an admin creating a household login for someone else does not want their
 * own vault offered, and the field keeps `autoComplete="new-password"` for the
 * browser's own generator.
 */
export const PM_IGNORE = {
  'data-1p-ignore': '',
  'data-bwignore': '',
  'data-lpignore': 'true',
}
