import { useEffect, useState } from 'react'

function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || ''
}

export function ChatPage() {
  const [channels, setChannels] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [dmName, setDmName] = useState('')
  const [error, setError] = useState(null)
  const [msg, setMsg] = useState(null)

  async function loadChannels() {
    const response = await fetch('/api/chat/channels', { credentials: 'same-origin' })
    if (!response.ok) throw new Error('channels')
    const data = await response.json()
    const list = Array.isArray(data.channels) ? data.channels : []
    setChannels(list)
    if (!activeId && list.length) setActiveId(list[0].id)
    return list
  }

  async function loadMessages(channelId) {
    if (!channelId) return
    const response = await fetch(`/api/chat/channels/${channelId}/messages`, {
      credentials: 'same-origin',
    })
    if (!response.ok) throw new Error('messages')
    const data = await response.json()
    setMessages(Array.isArray(data.messages) ? data.messages : [])
  }

  useEffect(() => {
    loadChannels().catch(() => setError(true))
  }, [])

  useEffect(() => {
    if (activeId) {
      loadMessages(activeId).catch(() => setError(true))
      const timer = window.setInterval(() => {
        loadMessages(activeId).catch(() => {})
      }, 8000)
      return () => window.clearInterval(timer)
    }
    return undefined
  }, [activeId])

  async function sendMessage(event) {
    event.preventDefault()
    if (!activeId || !body.trim()) return
    const response = await fetch(`/api/chat/channels/${activeId}/messages`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
      body: JSON.stringify({ body }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMsg(data.error || 'Send failed')
      return
    }
    setBody('')
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

  if (error) {
    return (
      <div className="gt-more-page">
        <p role="alert">Unable to load chat.</p>
      </div>
    )
  }

  const active = channels.find((c) => c.id === activeId)

  return (
    <div className="gt-more-page">
      <div className="gt-page-header">
        <h1>Chat</h1>
      </div>
      <p className="gt-more-page__lede">
        Household channels and direct messages. Use @username to mention.
      </p>
      <form className="gt-updates__search-form" onSubmit={openDm}>
        <label>
          Start DM
          <input value={dmName} onChange={(e) => setDmName(e.target.value)} placeholder="username" />
        </label>
        <button className="gt-btn" type="submit">
          Open
        </button>
      </form>
      {msg ? <p>{msg}</p> : null}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
        <section>
          <h2>Channels</h2>
          <ul>
            {channels.map((ch) => (
              <li key={ch.id}>
                <button
                  type="button"
                  className="gt-btn"
                  onClick={() => setActiveId(ch.id)}
                  aria-pressed={ch.id === activeId}
                >
                  {ch.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>{active?.name || 'Select a channel'}</h2>
          <ul>
            {messages.map((m) => (
              <li key={m.id}>
                <strong>{m.user}</strong>: {m.body}
              </li>
            ))}
          </ul>
          <form className="gt-updates__search-form" onSubmit={sendMessage}>
            <label>
              Message
              <input value={body} onChange={(e) => setBody(e.target.value)} />
            </label>
            <button className="gt-btn" type="submit" disabled={!activeId}>
              Send
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
