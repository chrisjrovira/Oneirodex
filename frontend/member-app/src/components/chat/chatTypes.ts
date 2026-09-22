/** Types shared by ChatPanel and the pieces extracted from it (H-D.2), as the panel reads them. */

export interface ChatChannel {
  id: number | string
  name?: string | null
  kind?: string | null
  type?: string | null
  muted?: boolean
  unread?: number | null
  [key: string]: unknown
}

export interface ChatAttachment {
  id?: number | string
  url?: string | null
  filename?: string | null
  [key: string]: unknown
}

export interface ChatMessage {
  id: number | string
  body?: string | null
  created_at?: string | null
  user?: string | null
  /** Emojis the viewer has reacted with (not a boolean, despite the name). */
  mine?: string[] | null
  parent_message_id?: number | string | null
  /** emoji -> count */
  reactions?: Record<string, number> | null
  attachments?: ChatAttachment[] | null
  [key: string]: unknown
}

/** One emoji in the picker / reaction bar: a unicode emoji or a custom image. */
export interface ReactionItem {
  emoji: string
  label?: string
  slug?: string | null
  url?: string | null
}

export interface ChatSearchHit {
  channel?: ChatChannel | null
  message?: ChatMessage | null
  [key: string]: unknown
}
