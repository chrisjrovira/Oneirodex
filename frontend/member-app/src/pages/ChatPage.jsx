import { useEffect, useRef, useState } from 'react'
import { PageStatus } from '../components/PageStatus'
import { VoiceLobby } from '../components/VoiceLobby'
import './ChatPage.css'

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
        width={18}
        height={18}
        style={{ verticalAlign: 'middle' }}
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

export function ChatPage() {
  const [channels, setChannels] = useState([])
  const [channelsLoading, setChannelsLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [dmName, setDmName] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [searchHits, setSearchHits] = useState([])
  const [replyTo, setReplyTo] = useState(null)
  const [error, setError] = useState(null)
  const [msg, setMsg] = useState(null)
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
    if (!activeId && list.length) setActiveId(list[0].id)
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
      setMsg(data.error || 'Send failed')
      return
    }
    setBody('')
    setReplyTo(null)
    setMsg(null)
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
      setMsg(data.error || 'DM failed')
      return
    }
    setDmName('')
    await loadChannels()
    if (data.channel?.id) setActiveId(data.channel.id)
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
      setMsg(data.error || 'Search failed')
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
      setMsg(data.error || 'Mute failed')
      return
    }
    setChannels((prev) =>
      prev.map((ch) => (ch.id === activeId ? { ...ch, muted: Boolean(data.muted) } : ch)),
    )
    setMsg(null)
  }

  if (error) {
    return (
      <div className="gt-more-page">
        <p role="alert">Unable to load chat.</p>
      </div>
    )
  }

  const active = channels.find((c) => c.id === activeId)

  return (
    <div className="gt-more-page gt-chat-page">
      <div className="gt-page-header">
        <h1>Chat</h1>
      </div>
      <p className="gt-more-page__lede">
        Household rooms and DMs — pick a channel, type, react. Voice lives on Activity when LiveKit is on.
      </p>

      <div className="gt-chat-page__toolbar">
        <form onSubmit={openDm}>
          <label>
            Direct message
            <input
              value={dmName}
              onChange={(e) => setDmName(e.target.value)}
              placeholder="username"
              autoComplete="off"
            />
          </label>
          <button className="gt-btn" type="submit">
            Open
          </button>
        </form>
        <form onSubmit={runSearch}>
          <label>
            Search
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="find a message"
              autoComplete="off"
            />
          </label>
          <button className="gt-btn" type="submit">
            Search
          </button>
        </form>
      </div>

      {searchHits.length > 0 ? (
        <section>
          <h2>Search results</h2>
          <ul className="gt-chat-search-hits">
            {searchHits.map((hit) => (
              <li key={`${hit.channel?.id}-${hit.message?.id}`}>
                <button
                  type="button"
                  className="gt-btn"
                  onClick={() => {
                    if (hit.channel?.id) setActiveId(hit.channel.id)
                    setSearchHits([])
                  }}
                >
                  {hit.channel?.name}: {hit.message?.user} — {hit.message?.body}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {msg ? <p role="status">{msg}</p> : null}

      <div className="gt-chat-layout">
        <aside className="gt-chat-channels" aria-label="Channels">
          <h2>Rooms</h2>
          {channelsLoading ? (
            <PageStatus loading loadingMessage="Loading rooms…" />
          ) : channels.length === 0 ? (
            <PageStatus emptyMessage="No channels yet — #general appears after first visit when chat is seeded." />
          ) : (
            <ul>
              {channels.map((ch) => (
                <li key={ch.id}>
                  <button
                    type="button"
                    className={`gt-chat-channel${ch.muted ? ' is-muted' : ''}`}
                    onClick={() => setActiveId(ch.id)}
                    aria-pressed={ch.id === activeId}
                  >
                    {ch.name}
                    {ch.muted ? ' · muted' : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="gt-chat-thread" aria-label="Messages">
          <div className="gt-chat-thread__head">
            <strong>{active?.name || 'Select a room'}</strong>
            {active ? (
              <button
                type="button"
                className="gt-btn"
                onClick={() => void toggleMute()}
                aria-pressed={Boolean(active.muted)}
              >
                {active.muted ? 'Unmute' : 'Mute'}
              </button>
            ) : null}
          </div>

          <ul className="gt-chat-messages">
            {!activeId ? (
              <li className="gt-chat-empty">Choose a room to start chatting.</li>
            ) : messages.length === 0 ? (
              <li className="gt-chat-empty">No messages yet — say hi.</li>
            ) : (
              messages.map((m) => {
                const parent = m.parent_message_id
                  ? messages.find((x) => x.id === m.parent_message_id)
                  : null
                return (
                  <li key={m.id} className="gt-chat-msg">
                    {parent ? (
                      <div className="gt-chat-reply-ref">
                        ↳ {parent.user}: {String(parent.body).slice(0, 80)}
                      </div>
                    ) : null}
                    <div className="gt-chat-msg__meta">
                      <span className="gt-chat-msg__user">{m.user}</span>
                    </div>
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
            <p className="gt-chat-empty">
              Replying to <strong>{replyTo.user}</strong>: {String(replyTo.body).slice(0, 60)}{' '}
              <button type="button" className="gt-btn" onClick={() => setReplyTo(null)}>
                Cancel
              </button>
            </p>
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
            <button className="gt-btn gt-btn--primary" type="submit" disabled={!activeId}>
              Send
            </button>
          </form>
        </section>
      </div>

      <VoiceLobby compact />
    </div>
  )
}
