/**
 * Fetch mocks for `createBrowserRequester` / `unwrapResponse`.
 *
 * A 2xx response is only parsed when `Content-Type` includes `application/json`.
 * A 4xx/5xx body is read via `.text()`, not `.json()`.
 */

export function jsonResponse(body, { ok = true, status = 200 } = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body ?? {})
  return Promise.resolve({
    ok,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(payload),
  })
}

export function jsonFrom(result) {
  return Promise.resolve(result).then((res) => {
    if (res == null) return res
    if (
      res.headers &&
      typeof res.headers.get === 'function' &&
      typeof res.text === 'function' &&
      typeof res.json === 'function'
    ) {
      return res
    }
    const jsonFn = typeof res.json === 'function' ? () => res.json() : async () => res
    return Promise.resolve(jsonFn()).then((body) => ({
      ok: res.ok !== false && (res.status == null || (res.status >= 200 && res.status < 300)),
      status: res.status ?? (res.ok === false ? 500 : 200),
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body ?? {})),
    }))
  })
}

export function stubFetch(impl) {
  const fn = vi.fn((...args) => jsonFrom(impl(...args)))
  global.fetch = fn
  return fn
}

export function requestHeaders(call) {
  return new Headers(call?.[1]?.headers)
}
