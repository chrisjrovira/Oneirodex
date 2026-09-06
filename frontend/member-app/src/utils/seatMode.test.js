import { getSeatMode, isThinSeat } from './seatMode'

function setSearch(search) {
  vi.stubGlobal('location', { ...window.location, search })
}

beforeEach(() => {
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

test('a plain browser tab is not a thin seat', () => {
  setSearch('')
  expect(getSeatMode()).toBe('browser')
  expect(isThinSeat()).toBe(false)
})

test('the thin shell marker is recognised', () => {
  setSearch('?seat=thin')
  expect(isThinSeat()).toBe(true)
})

test('the seat survives navigation away from the marked URL', () => {
  setSearch('?seat=thin')
  expect(isThinSeat()).toBe(true)
  // In-app routing drops the query string; the seat must not flip back.
  setSearch('')
  expect(isThinSeat()).toBe(true)
})

test('an unknown seat value is ignored rather than trusted', () => {
  setSearch('?seat=admin')
  expect(getSeatMode()).toBe('browser')
})
