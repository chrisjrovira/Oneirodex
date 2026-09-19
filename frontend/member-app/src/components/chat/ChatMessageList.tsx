import type { RefObject } from 'react'
import type { ChatMessage, ReactionItem } from './chatTypes'
import { MessageAttachments, ReactionLabel, formatMsgTime } from '../chat/chatHelpers'

/** The message list with reply and reaction controls per row. */
export function ChatMessageList({
  activeId,
  listEndRef,
  messages,
  reactionItems,
  setReplyTo,
  toggleReaction,
}: {
  activeId: number | string | null
  listEndRef: RefObject<HTMLLIElement | null>
  messages: ChatMessage[]
  reactionItems: ReactionItem[]
  setReplyTo: (message: ChatMessage | null) => void
  toggleReaction: (messageId: number | string, emoji: string) => Promise<void>
}) {
  return (
    <ul className="od-chat-messages">
      {!activeId ? (
        <li className="od-chat-empty">Choose a room to start chatting.</li>
      ) : messages.length === 0 ? (
        <li className="od-chat-empty">No messages yet — say hi.</li>
      ) : (
        messages.map((m, index) => {
          const prev = messages[index - 1]
          const sameAuthor = prev && prev.user === m.user
          const parent = m.parent_message_id
            ? messages.find((x) => x.id === m.parent_message_id)
            : null
          return (
            <li key={m.id} className={`od-chat-msg${sameAuthor ? ' is-continued' : ''}`}>
              {parent ? (
                <div className="od-chat-reply-ref">
                  ↳ {parent.user}: {String(parent.body).slice(0, 80)}
                </div>
              ) : null}
              {!sameAuthor ? (
                <div className="od-chat-msg__meta">
                  <span className="od-chat-msg__user">{m.user}</span>
                  <time className="od-chat-msg__time" dateTime={m.created_at || undefined}>
                    {formatMsgTime(m.created_at)}
                  </time>
                </div>
              ) : null}
              {m.body && String(m.body).trim() ? (
                <p className="od-chat-msg__body">{m.body}</p>
              ) : null}
              <MessageAttachments attachments={m.attachments} />
              <div className="od-chat-msg__actions">
                <button
                  type="button"
                  className="od-cbtn od-cbtn--ghost od-btn--sm"
                  onClick={() => setReplyTo(m)}
                >
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
                      /* `is-on` is the bar language's pressed state, and
                         it is already keyed off exactly this condition
                         everywhere else — a reaction you left reads the
                         same as an active filter. */
                      className={`od-cbtn od-btn--sm${mine ? ' is-on' : ''}`}
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
  )
}
