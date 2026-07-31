import { useEffect, useRef, useState } from 'react'
import { PageStatus } from './PageStatus'
import { VoiceLobby } from './VoiceLobby'
import { canArchiveChannel, canLeaveChannel, slugifyRoomName } from '../hooks/chatPanelApi'
import '../pages/ChatPage.css'

const FIXED_REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '👀']
const POLL_MS = 8000

function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || ''
}

function ReactionLabel({ item }) {
  if (item.url) {
    return (
      <img
        src={item.url}
        alt={item.label || item.emoji}
        width={16}
        height={16}
        className="gt-chat-reaction-img"
      />
    )
  }
  return item.emoji
}

function mergeById(existing, incoming) {
  if (!incoming.length) return existing
  const seen = new Set(existing.map((m) => m.id))
  const added = incoming.filter((m) => !seen.has(m.id))
  return added.length ? [...existing, ...added] : existing
}

function formatMsgTime(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

/**
 * Household chat body — rooms sidebar · message pane · composer.
 * Used inside ChatSlideOut (primary) and kept route-agnostic.
 */
export function ChatPanel({
  compact = false,
  initialChannelId = null,
  canCreateRooms = true,
  viewer = {},
  onClose,
}) {
  const [channels, setChannels] = useState([])
  const [channelsLoading, setChannelsLoading] = useState(true)
  const [activeId, setActiveId] = useState(initialChannelId)
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [dmName, setDmName] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [searchHits, setSearchHits] = useState([])
  const [replyTo, setReplyTo] = useState(null)
  const [error, setError] = useState(null)
  const [msg, setMsg] = useState(null)
  const [msgIsError, setMsgIsError] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [roomActionBusy, setRoomActionBusy] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [reactionItems, setReactionItems] = useState(
    FIXED_REACTION_EMOJIS.map((emoji) => ({ emoji, label: emoji })),
  )
  const messagesRef = useRef([])
  const listEndRef = useRef(null)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    listEndRef.current?.scrollIntoView?.({ block: 'end' })
  }, [messages, activeId])

  useEffect(() => {
    if (initialChannelId != null) setActiveId(initialChannelId)
  }, [initialChannelId])

  function showStatus(text, { isError = false } = {}) {
    setMsg(text)
    setMsgIsError(isError)
  }

  async function loadEmoji() {
    try {
      const response = await fetch('/api/chat/emoji', { credentials: 'same-origin' })
      if (!response.ok) return
      const data = await response.json()
      const fixed = (Array.isArray(data.fixed) ? data.fixed : FIXED_REACTION_EMOJIS).map((emoji) => ({
        emoji,
        label: emoji,
      }))
      const custom = (Array.isArray(data.custom) ? data.custom : []).map((row) => ({
        emoji: row.emoji || `:${row.slug}:`,
        label: row.label || row.slug,
        url: row.url,
      }))
      setReactionItems([...fixed, ...custom])
    } catch {
      // Keep fixed set on failure.
    }
  }

  async function loadChannels() {
    const response = await fetch('/api/chat/channels', { credentials: 'same-origin' })
    if (!response.ok) throw new Error('channels')
    const data = await response.json()
    const list = Array.isArray(data.channels) ? data.channels : []
    setChannels(list)
    setActiveId((prev) => {
      if (prev && list.some((c) => c.id === prev)) return prev
      if (initialChannelId && list.some((c) => c.id === initialChannelId)) return initialChannelId
      return list.length ? list[0].id : null
    })
    return list
  }

  async function loadMessages(channelId, { sinceId } = {}) {
    if (!channelId) return
    const params = new URLSearchParams()
    if (sinceId) params.set('since', String(sinceId))
    const qs = params.toString()
    const url = `/api/chat/channels/${channelId}/messages${qs ? `?${qs}` : ''}`
    const response = await fetch(url, { credentials: 'same-origin' })
    if (!response.ok) throw new Error('messages')
    const data = await response.json()
    const next = Array.isArray(data.messages) ? data.messages : []
    if (sinceId) {
      setMessages((prev) => mergeById(prev, next))
    } else {
      setMessages(next)
    }
  }

  useEffect(() => {
    setChannelsLoading(true)
    loadChannels()
      .catch(() => setError(true))
      .finally(() => setChannelsLoading(false))
    void loadEmoji()
  }, [])

  useEffect(() => {
    if (!activeId) return undefined

    let cancelled = false
    let timer = 0

    async function fullLoad() {
      try {
        await loadMessages(activeId)
      } catch {
        if (!cancelled) setError(true)
      }
    }

    async function pollIncremental() {
      if (document.visibilityState === 'hidden') return
      const last = messagesRef.current[messagesRef.current.length - 1]
      try {
        if (last?.id) {
          await loadMessages(activeId, { sinceId: last.id })
        } else {
          await loadMessages(activeId)
        }
      } catch {
        // Keep last good snapshot on poll failure.
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        void pollIncremental()
      }
    }

    void fullLoad()
    timer = window.setInterval(() => {
      void pollIncremental()
    }, POLL_MS)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [activeId])

  async function sendMessage(event) {
    event.preventDefault()
    if (!activeId || !body.trim()) return
    const response = await fetch(`/api/chat/channels/${activeId}/messages`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
      body: JSON.stringify({
        body,
        parent_message_id: replyTo?.id || undefined,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      showStatus(data.error || 'Send failed', { isError: true })
      return
    }
    setBody('')
    setReplyTo(null)
    showStatus(null)
    await loadMessages(activeId)
  }

  async function openDm(event) {
    event.preventDefault()
    const username = dmName.trim()
    if (!username) return
    const response = await fetch('/api/chat/dm', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
      body: JSON.stringify({ username }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      showStatus(data.error || 'DM failed', { isError: true })
      return
    }
    setDmName('')
    await loadChannels()
    if (data.channel?.id) setActiveId(data.channel.id)
  }

  async function createRoom(event) {
    event.preventDefault()
    const name = newRoomName.trim()
    if (!name) return
    const slug = slugifyRoomName(name)
    if (!slug) {
      showStatus('Room name needs letters or numbers', { isError: true })
      return
    }
    setCreatingRoom(true)
    showStatus(null)
    try {
      const response = await fetch('/api/chat/channels', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
        body: JSON.stringify({ name, slug, is_child_safe: true }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        showStatus(data.error || 'Could not create room', { isError: true })
        return
      }
      setNewRoomName('')
      await loadChannels()
      if (data.channel?.id) setActiveId(data.channel.id)
    } finally {
      setCreatingRoom(false)
    }
  }

  async function runSearch(event) {
    event.preventDefault()
    const q = searchQ.trim()
    if (q.length < 2) {
      setSearchHits([])
      return
    }
    const response = await fetch(`/api/chat/search?q=${encodeURIComponent(q)}`, {
      credentials: 'same-origin',
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      showStatus(data.error || 'Search failed', { isError: true })
      return
    }
    setSearchHits(Array.isArray(data.results) ? data.results : [])
  }

  async function toggleReaction(messageId, emoji) {
    const response = await fetch(`/api/chat/messages/${messageId}/reactions`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
      body: JSON.stringify({ emoji }),
    })
    if (!response.ok) return
    const data = await response.json().catch(() => ({}))
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, reactions: data.reactions || {}, mine: data.mine || [] }
          : m,
      ),
    )
  }

  async function toggleMute() {
    if (!activeId) return
    const current = channels.find((c) => c.id === activeId)
    if (!current) return
    const nextMuted = !Boolean(current.muted)
    const response = await fetch(`/api/chat/channels/${activeId}/mute`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
      body: JSON.stringify({ muted: nextMuted }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      showStatus(data.error || 'Mute failed', { isError: true })
      return
    }
    setChannels((prev) =>
      prev.map((ch) => (ch.id === activeId ? { ...ch, muted: Boolean(data.muted) } : ch)),
    )
    showStatus(null)
  }

  async function archiveActiveRoom() {
    if (!activeId || roomActionBusy) return
    const current = channels.find((c) => c.id === activeId)
    if (!current || !canArchiveChannel(current, viewer)) return
    const label = current.name?.replace(/^#/, '') || current.name || 'this room'
    const ok = window.confirm(`Archive #${label}? The room will be hidden for everyone.`)
    if (!ok) return
    setRoomActionBusy(true)
    showStatus(null)
    try {
      const response = await fetch(`/api/chat/channels/${activeId}/archive`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRFToken': csrfToken() },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 403) {
          showStatus(data.error || 'You don’t have permission to archive this room', {
            isError: true,
          })
        } else {
          showStatus(data.error || 'Archive failed', { isError: true })
        }
        return
      }
      setMessages([])
      setReplyTo(null)
      await loadChannels()
    } finally {
      setRoomActionBusy(false)
    }
  }

  async function leaveActiveRoom() {
    if (!activeId || roomActionBusy) return
    const current = channels.find((c) => c.id === activeId)
    if (!current || !canLeaveChannel(current)) return
    const isDm = current.kind === 'dm' || current.type === 'dm'
    const leftId = activeId
    const label = current.name?.replace(/^#/, '') || current.name || 'this room'
    const confirmText = isDm
      ? `Leave conversation with ${label}? You can open a new DM later.`
      : `Leave #${label}? This mutes the room (same as Mute). You can unmute later.`
    if (!window.confirm(confirmText)) return
    setRoomActionBusy(true)
    showStatus(null)
    try {
      const response = await fetch(`/api/chat/channels/${activeId}/leave`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRFToken': csrfToken() },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 403) {
          showStatus(data.error || 'You don’t have permission to leave this room', {
            isError: true,
          })
        } else {
          showStatus(data.error || 'Leave failed', { isError: true })
        }
        return
      }
      if (isDm) {
        setMessages([])
        setReplyTo(null)
      } else {
        // Household leave = mute; bias list immediately, then refresh so API muted wins.
        const mutedAfterLeave =
          typeof data.muted === 'boolean' ? data.muted : true
        setChannels((prev) =>
          prev.map((ch) => (ch.id === leftId ? { ...ch, muted: mutedAfterLeave } : ch)),
        )
      }
      await loadChannels()
    } finally {
      setRoomActionBusy(false)
    }
  }

  if (error) {
    return (
      <div className="gt-chat-panel gt-chat-panel--error" role="alert">
        <p>Unable to load chat.</p>
      </div>
    )
  }

  const active = channels.find((c) => c.id === activeId)
  const roomChannels = channels.filter((c) => c.kind !== 'dm')
  const dmChannels = channels.filter((c) => c.kind === 'dm')
  const showArchive = canArchiveChannel(active, viewer)
  const showLeave = canLeaveChannel(active)

  return (
    <div className={`gt-chat-panel${compact ? ' gt-chat-panel--compact' : ''}`}>
      <div className="gt-chat-layout">
        <aside className="gt-chat-channels" aria-label="Rooms">
          <div className="gt-chat-channels__head">
            <h2>Rooms</h2>
            <button
              type="button"
              className="gt-chat-icon-btn"
              aria-expanded={showTools}
              aria-controls="gt-chat-tools"
              onClick={() => setShowTools((v) => !v)}
              title={showTools ? 'Hide search & DM' : 'Search & DM'}
            >
              {showTools ? 'Less' : 'More'}
            </button>
          </div>

          {showTools ? (
            <div id="gt-chat-tools" className="gt-chat-tools">
              <form className="gt-chat-tool-form" onSubmit={runSearch}>
                <label className="gt-chat-sr-only" htmlFor="gt-chat-search">
                  Search messages
                </label>
                <input
                  id="gt-chat-search"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Search messages"
                  autoComplete="off"
                />
                <button className="gt-btn gt-btn--secondary" type="submit">
                  Go
                </button>
              </form>
              <form className="gt-chat-tool-form" onSubmit={openDm}>
                <label className="gt-chat-sr-only" htmlFor="gt-chat-dm">
                  Direct message
                </label>
                <input
                  id="gt-chat-dm"
                  value={dmName}
                  onChange={(e) => setDmName(e.target.value)}
                  placeholder="DM username"
                  autoComplete="off"
                />
                <button className="gt-btn gt-btn--secondary" type="submit">
                  Open
                </button>
              </form>
            </div>
          ) : null}

          {searchHits.length > 0 ? (
            <ul className="gt-chat-search-hits">
              {searchHits.map((hit) => (
                <li key={`${hit.channel?.id}-${hit.message?.id}`}>
                  <button
                    type="button"
                    className="gt-chat-search-hit"
                    onClick={() => {
                      if (hit.channel?.id) setActiveId(hit.channel.id)
                      setSearchHits([])
                      setShowTools(false)
                    }}
                  >
                    <span className="gt-chat-search-hit__ch">{hit.channel?.name}</span>
                    <span className="gt-chat-search-hit__body">
                      {hit.message?.user}: {hit.message?.body}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {channelsLoading ? (
            <PageStatus loading loadingMessage="Loading rooms…" />
          ) : channels.length === 0 ? (
            <PageStatus emptyMessage="No rooms yet — #general appears after first visit when chat is seeded." />
          ) : (
            <div className="gt-chat-channel-groups">
              {roomChannels.length > 0 ? (
                <ul className="gt-chat-channel-list" aria-label="Channels">
                  {roomChannels.map((ch) => (
                    <li key={ch.id}>
                      <button
                        type="button"
                        className={`gt-chat-channel${ch.muted ? ' is-muted' : ''}`}
                        onClick={() => setActiveId(ch.id)}
                        aria-pressed={ch.id === activeId}
                      >
                        <span className="gt-chat-channel__hash" aria-hidden="true">
                          #
                        </span>
                        <span className="gt-chat-channel__name">{ch.name?.replace(/^#/, '') || ch.name}</span>
                        {ch.muted ? <span className="gt-chat-channel__muted">muted</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {dmChannels.length > 0 ? (
                <>
                  <p className="gt-chat-channel-label">Direct</p>
                  <ul className="gt-chat-channel-list" aria-label="Direct messages">
                    {dmChannels.map((ch) => (
                      <li key={ch.id}>
                        <button
                          type="button"
                          className={`gt-chat-channel${ch.muted ? ' is-muted' : ''}`}
                          onClick={() => setActiveId(ch.id)}
                          aria-pressed={ch.id === activeId}
                        >
                          <span className="gt-chat-channel__hash" aria-hidden="true">
                            @
                          </span>
                          <span className="gt-chat-channel__name">{ch.name}</span>
                          {ch.muted ? <span className="gt-chat-channel__muted">muted</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          )}

          {canCreateRooms ? (
            <form className="gt-chat-create-room" onSubmit={createRoom}>
              <label className="gt-chat-sr-only" htmlFor="gt-chat-new-room">
                New room name
              </label>
              <input
                id="gt-chat-new-room"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="New room"
                autoComplete="off"
                disabled={creatingRoom}
              />
              <button className="gt-btn" type="submit" disabled={creatingRoom || !newRoomName.trim()}>
                Add
              </button>
            </form>
          ) : (
            <p className="gt-chat-create-hint">Ask a household member to create a room (child accounts cannot).</p>
          )}
        </aside>

        <section className="gt-chat-thread" aria-label="Messages">
          <div className="gt-chat-thread__head">
            <div className="gt-chat-thread__title">
              {active?.kind === 'dm' ? (
                <strong>{active?.name || 'Select a room'}</strong>
              ) : (
                <strong>
                  <span aria-hidden="true">#</span>
                  {active?.name?.replace(/^#/, '') || 'Select a room'}
                </strong>
              )}
            </div>
            <div className="gt-chat-thread__actions">
              {active ? (
                <button
                  type="button"
                  className="gt-chat-icon-btn"
                  onClick={() => void toggleMute()}
                  aria-pressed={Boolean(active.muted)}
                  disabled={roomActionBusy}
                >
                  {active.muted ? 'Unmute' : 'Mute'}
                </button>
              ) : null}
              {showLeave ? (
                <button
                  type="button"
                  className="gt-chat-icon-btn"
                  onClick={() => void leaveActiveRoom()}
                  disabled={roomActionBusy}
                >
                  Leave
                </button>
              ) : null}
              {showArchive ? (
                <button
                  type="button"
                  className="gt-chat-icon-btn"
                  onClick={() => void archiveActiveRoom()}
                  disabled={roomActionBusy}
                >
                  Archive
                </button>
              ) : null}
              {onClose ? (
                <button type="button" className="gt-chat-icon-btn" aria-label="Close chat" onClick={onClose}>
                  ×
                </button>
              ) : null}
            </div>
          </div>

          {msg ? (
            <p className={`gt-chat-status${msgIsError ? ' is-error' : ''}`} role={msgIsError ? 'alert' : 'status'}>
              {msg}
            </p>
          ) : null}

          <ul className="gt-chat-messages">
            {!activeId ? (
              <li className="gt-chat-empty">Choose a room to start chatting.</li>
            ) : messages.length === 0 ? (
              <li className="gt-chat-empty">No messages yet — say hi.</li>
            ) : (
              messages.map((m, index) => {
                const prev = messages[index - 1]
                const sameAuthor = prev && prev.user === m.user
                const parent = m.parent_message_id
                  ? messages.find((x) => x.id === m.parent_message_id)
                  : null
                return (
                  <li key={m.id} className={`gt-chat-msg${sameAuthor ? ' is-continued' : ''}`}>
                    {parent ? (
                      <div className="gt-chat-reply-ref">
                        ↳ {parent.user}: {String(parent.body).slice(0, 80)}
                      </div>
                    ) : null}
                    {!sameAuthor ? (
                      <div className="gt-chat-msg__meta">
                        <span className="gt-chat-msg__user">{m.user}</span>
                        <time className="gt-chat-msg__time" dateTime={m.created_at || undefined}>
                          {formatMsgTime(m.created_at)}
                        </time>
                      </div>
                    ) : null}
                    <p className="gt-chat-msg__body">{m.body}</p>
                    <div className="gt-chat-msg__actions">
                      <button type="button" onClick={() => setReplyTo(m)}>
                        Reply
                      </button>
                      {reactionItems.map((item) => {
                        const emoji = item.emoji
                        const count = m.reactions?.[emoji] || 0
                        const mine = Array.isArray(m.mine) && m.mine.includes(emoji)
                        return (
                          <button
                            key={emoji}
                            type="button"
                            aria-pressed={mine}
                            title={mine ? `Remove ${item.label}` : `React ${item.label}`}
                            onClick={() => void toggleReaction(m.id, emoji)}
                          >
                            <ReactionLabel item={item} />
                            {count ? ` ${count}` : ''}
                          </button>
                        )
                      })}
                    </div>
                  </li>
                )
              })
            )}
            <li ref={listEndRef} aria-hidden="true" />
          </ul>

          {replyTo ? (
            <div className="gt-chat-reply-bar">
              <span>
                Replying to <strong>{replyTo.user}</strong>: {String(replyTo.body).slice(0, 60)}
              </span>
              <button type="button" className="gt-chat-icon-btn" onClick={() => setReplyTo(null)}>
                Cancel
              </button>
            </div>
          ) : null}

          <form className="gt-chat-composer" onSubmit={sendMessage}>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={active ? `Message ${active.name}` : 'Select a room first'}
              disabled={!activeId}
              rows={2}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
            />
            <button className="gt-btn gt-btn--primary" type="submit" disabled={!activeId || !body.trim()}>
              Send
            </button>
          </form>
        </section>
      </div>

      <div className="gt-chat-voice">
        <VoiceLobby compact />
      </div>
    </div>
  )
}
