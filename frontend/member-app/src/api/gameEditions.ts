import { getJson } from './client'

/**
 * Every system this title exists on in the library, with per-core launchers.
 *
 * The grid renders one tile per library row, so a title held on two systems is
 * two unrelated tiles. This is what lets the preview say "also on SNES" and
 * offer a launcher for each core the member could actually play it with.
 */
export async function fetchGameEditions(gameUuid: any, { signal }: LooseProps = {}) {
  return getJson(`/api/games/${encodeURIComponent(gameUuid)}/editions`, {
    signal,
    label: 'game editions',
  })
}
