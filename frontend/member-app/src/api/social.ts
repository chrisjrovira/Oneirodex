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
import { getJson, postJson, sendResult } from './client'

function httpFailure(err: any) {
  return typeof err?.status === 'number'
}

export async function fetchActivity({ signal, friendsOnly }: LooseProps = {}) {
  const qs = friendsOnly ? '?friends_only=1' : ''
  return getJson(`/api/activity${qs}`, { signal, label: 'Activity' })
}

export async function fetchSocialStatus({ signal }: LooseProps = {}) {
  try {
    return await getJson('/api/social/status', { signal, label: 'social/status' })
  } catch (err: any) {
    if (httpFailure(err)) {
      return null
    }
    throw err
  }
}

export async function fetchFriends({ signal }: LooseProps = {}) {
  try {
    return await getJson('/api/social/friends', { signal, label: 'social/friends' })
  } catch (err: any) {
    if (httpFailure(err)) {
      return { friends: [] }
    }
    throw err
  }
}

export async function requestFriend(username: any) {
  return (await postJson('/api/social/friends', { username }, { label: 'Request failed' })) ?? {}
}

export async function acceptFriend(id: any) {
  const result = await sendResult(`/api/social/friends/${id}/accept`, { method: 'POST' })
  return result.ok
}

export async function rejectFriend(id: any) {
  const result = await sendResult(`/api/social/friends/${id}/reject`, { method: 'POST' })
  return result.ok
}

export async function removeFriend(id: any) {
  const result = await sendResult(`/api/social/friends/${id}`, { method: 'DELETE' })
  return result.ok
}

export async function fetchMemberProfile(userId: any, { signal }: LooseProps = {}) {
  return getJson(`/api/users/${userId}/profile`, { signal, label: 'Profile' })
}
