/**
 * Social surface: the activity feed, presence, friends, and member profiles.
 *
 * These calls were inlined across ActivityPage and MemberProfilePage — some as
 * module-level helpers, the friend mutations as bare `fetch()` in click
 * handlers. Consolidated here in wave B1.4.
 *
 * `fetchActivity` and `fetchMemberProfile` report failures through the shared
 * envelope builder. `fetchSocialStatus` / `fetchFriends` stay best-effort and
 * resolve to an empty shape on a failed response: they load alongside the feed
 * in one `Promise.all`, and a degraded presence service must not blank the
 * whole Activity page. The friend mutations are fire-and-forget by existing
 * design — the caller refetches the list afterwards — so they resolve to the
 * response's `ok` flag rather than throwing.
 */
import { csrfHeaders, errorFromResponse } from '@oneirodex/ui'

export async function fetchActivity({ signal, friendsOnly } = {}) {
  const qs = friendsOnly ? '?friends_only=1' : ''
  const response = await fetch(`/api/activity${qs}`, {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'Activity')
  }
  return response.json()
}

export async function fetchSocialStatus({ signal } = {}) {
  const response = await fetch('/api/social/status', {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) {
    return null
  }
  return response.json()
}

export async function fetchFriends({ signal } = {}) {
  const response = await fetch('/api/social/friends', {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) {
    return { friends: [] }
  }
  return response.json()
}

export async function requestFriend(username) {
  const response = await fetch('/api/social/friends', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ username }),
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'Request failed')
  }
  return response.json().catch(() => ({}))
}

export async function acceptFriend(id) {
  const response = await fetch(`/api/social/friends/${id}/accept`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders(),
  })
  return response.ok
}

export async function rejectFriend(id) {
  const response = await fetch(`/api/social/friends/${id}/reject`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders(),
  })
  return response.ok
}

export async function removeFriend(id) {
  const response = await fetch(`/api/social/friends/${id}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: csrfHeaders(),
  })
  return response.ok
}

export async function fetchMemberProfile(userId, { signal } = {}) {
  const response = await fetch(`/api/users/${userId}/profile`, {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'Profile')
  }
  return response.json()
}
