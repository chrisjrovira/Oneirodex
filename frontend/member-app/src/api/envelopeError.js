/**
 * One way to turn a failed response into an Error, for every api/ wrapper.
 *
 * Why this exists
 * ---------------
 * Each wrapper hand-rolled its own, and they had drifted into two broken tiers:
 *
 *   throw new Error(`announcements ${response.status}`)   // body never read
 *   throw new Error(data.error)                           // machine fields lost
 *
 * The first is the worse one. `PageStatus` shows an Error's message as the
 * headline, so a member reading "announcements 500" was being shown a developer
 * string — the exact thing the GT-B1 envelope exists to replace, undone on the
 * last hop. The second reaches `resolveErrorMessage` intact but drops
 * `error_code` and `status`, which is what `resolveErrorDetail` renders.
 *
 * So: read the body once, prefer the backend's sentence, keep the machine
 * fields on the Error, and fall back to the old developer string only when
 * there is genuinely nothing better to say.
 */

/**
 * Build an Error from a body that has already been read.
 *
 * Some wrappers need the parsed body on the success path too, and a Response
 * body can only be consumed once — calling `errorFromResponse` after that would
 * silently get nothing and fall back to the developer string. Those callers use
 * this instead, so there is still exactly one definition of the Error shape.
 *
 * @param {object|null} data   parsed response body, or null when there was none
 * @param {number} status      HTTP status of the failed response
 * @param {string} fallback    label used when the body carries no message
 * @returns {Error}
 */
export function errorFromBody(data, status, fallback) {
  const sentence = typeof data?.error === 'string' ? data.error.trim() : ''

  const error = new Error(sentence || `${fallback} ${status}`)
  error.status = status
  if (typeof data?.error_code === 'string' && data.error_code) {
    error.error_code = data.error_code
  }
  if (data !== null && data !== undefined) {
    error.data = data
  }
  return error
}

/**
 * Build an Error from a response that failed (`!response.ok`).
 *
 * Reads the body itself, so call it *before* consuming the response elsewhere.
 *
 * @param {Response} response  the failed response; its body is read here
 * @param {string} fallback    label used when the body carries no message,
 *                             e.g. 'announcements' -> "announcements 500"
 * @returns {Promise<Error>}   an Error carrying `status`, and `error_code` /
 *                             `data` when the body supplied them
 */
export async function errorFromResponse(response, fallback) {
  let data = null
  try {
    data = await response.json()
  } catch {
    // No JSON body (HTML error page, empty 502, aborted stream), or the body
    // was already consumed. The fallback label is all we have.
  }

  return errorFromBody(data, response.status, fallback)
}
