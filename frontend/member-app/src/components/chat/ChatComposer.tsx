import type { ChangeEvent, FormEvent, RefObject } from 'react'
import type { ChatAttachment, ChatChannel, ChatMessage, ReactionItem } from './chatTypes'
import {
  ATTACH_ACCEPT,
  ATTACH_HINT_CHILD,
  ATTACH_HINT_UNAVAILABLE,
  ReactionLabel,
} from '../chat/chatHelpers'
import { Button } from '@oneirodex/ui'

/** Reply bar, pending attachments, attach hint, emoji picker and the composer form. */
export function ChatComposer({
  active,
  activeId,
  attachAvailable,
  attachDisabled,
  attachHint,
  body,
  canSend,
  composerRef,
  emojiPickerId,
  fileInputRef,
  handleAttachFiles,
  insertEmoji,
  pendingAttachments,
  reactionItems,
  replyTo,
  sendMessage,
  setBody,
  setPendingAttachments,
  setReplyTo,
  setShowEmojiPicker,
  showEmojiPicker,
  viewerIsChild,
}: {
  active: ChatChannel | null | undefined
  activeId: number | string | null
  attachAvailable: boolean | null
  attachDisabled: boolean
  attachHint: string | null
  body: string
  canSend: boolean
  composerRef: RefObject<HTMLTextAreaElement | null>
  emojiPickerId: string
  fileInputRef: RefObject<HTMLInputElement | null>
  handleAttachFiles: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  insertEmoji: (item: ReactionItem) => void
  pendingAttachments: ChatAttachment[]
  reactionItems: ReactionItem[]
  replyTo: ChatMessage | null
  sendMessage: (event: FormEvent<HTMLFormElement>) => Promise<void>
  setBody: (value: string) => void
  setPendingAttachments: (update: (prev: ChatAttachment[]) => ChatAttachment[]) => void
  setReplyTo: (message: ChatMessage | null) => void
  setShowEmojiPicker: (update: boolean | ((open: boolean) => boolean)) => void
  showEmojiPicker: boolean
  viewerIsChild: boolean
}) {
  return (
    <>
      {replyTo ? (
        <div className="od-chat-reply-bar">
          <span>
            Replying to <strong>{replyTo.user}</strong>: {String(replyTo.body).slice(0, 60)}
          </span>
          <button type="button" className="od-chat-icon-btn" onClick={() => setReplyTo(null)}>
            Cancel
          </button>
        </div>
      ) : null}

      {pendingAttachments.length > 0 ? (
        <ul className="od-chat-pending-attachments" aria-label="Pending attachments">
          {pendingAttachments.map((att) => (
            <li key={att.id ?? att.filename}>
              <span>{att.filename || 'file'}</span>
              <button
                type="button"
                className="od-chat-icon-btn"
                aria-label={`Remove ${att.filename || 'attachment'}`}
                onClick={() => setPendingAttachments((prev) => prev.filter((row) => row !== att))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {attachHint ? (
        <p className="od-chat-attach-hint" role="status">
          {attachHint}
        </p>
      ) : null}

      {showEmojiPicker ? (
        <div id={emojiPickerId} className="od-chat-emoji-picker" role="listbox" aria-label="Emoji">
          {reactionItems.map((item) => (
            <button
              key={item.emoji}
              type="button"
              role="option"
              className="od-chat-emoji-picker__btn"
              title={item.label}
              onClick={() => insertEmoji(item)}
            >
              <ReactionLabel item={item} />
            </button>
          ))}
        </div>
      ) : null}

      <form className="od-chat-composer" onSubmit={sendMessage}>
        <div className="od-chat-composer__tools">
          <button
            type="button"
            className="od-chat-composer__tool"
            aria-label="Insert emoji"
            aria-expanded={showEmojiPicker}
            aria-controls={emojiPickerId}
            disabled={!activeId}
            onClick={() => setShowEmojiPicker((v) => !v)}
          >
            🙂
          </button>
          <button
            type="button"
            className="od-chat-composer__tool"
            aria-label="Attach file"
            title={
              viewerIsChild
                ? ATTACH_HINT_CHILD
                : attachAvailable === false
                  ? ATTACH_HINT_UNAVAILABLE
                  : 'Attach image or file'
            }
            disabled={attachDisabled}
            onClick={() => fileInputRef.current?.click()}
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="od-chat-sr-only"
            tabIndex={-1}
            accept={ATTACH_ACCEPT}
            multiple
            onChange={(event) => void handleAttachFiles(event)}
          />
        </div>
        <textarea
          ref={composerRef}
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
        <Button variant="primary" type="submit" disabled={!canSend}>
          Send
        </Button>
      </form>
    </>
  )
}
