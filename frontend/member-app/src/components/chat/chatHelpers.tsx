import { isImageAttachment, normalizeAttachments } from '../../hooks/chatPanelApi'
import type { ChatAttachment, ReactionItem } from './chatTypes'
/* Module-level helpers moved out of ChatPanel (v11 cycle, H-D.2), unchanged. */
export const FIXED_REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '👀']
export const POLL_MS = 8000
export const MAX_ATTACHMENTS_PER_MESSAGE = 5
export const ATTACH_ACCEPT =
  '.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.pdf,image/png,image/jpeg,image/webp,image/gif,text/plain,text/csv,application/pdf'
export const ATTACH_HINT_UNAVAILABLE =
  'File attach isn’t available yet — uploads land when the server enables them.'
export const ATTACH_HINT_CHILD = 'Child accounts can’t upload attachments.'

export function ReactionLabel({ item }: { item: ReactionItem }) {
  if (item.url) {
    return (
      <img
        src={item.url}
        alt={item.label || item.emoji}
        width={16}
        height={16}
        className="od-chat-reaction-img"
      />
    )
  }
  return item.emoji
}

export function MessageAttachments({
  attachments,
}: {
  attachments: ChatAttachment[] | null | undefined
}) {
  const list = normalizeAttachments(attachments)
  if (!list.length) return null
  return (
    <ul className="od-chat-attachments" aria-label="Attachments">
      {list.map((att) => {
        const key = att.id ?? att.url ?? att.filename
        const image = isImageAttachment(att)
        return (
          <li key={key} className="od-chat-attachment">
            {image && att.url ? (
              <a
                className="od-chat-attachment__thumb"
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img src={att.url} alt={att.filename || 'Image attachment'} loading="lazy" />
              </a>
            ) : null}
            {att.url ? (
              <a
                className="od-chat-attachment__link"
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                download={att.filename || undefined}
              >
                {image ? 'Open image' : att.filename || 'Download file'}
              </a>
            ) : (
              <span className="od-chat-attachment__link">{att.filename || 'Attachment'}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function mergeById(existing: any, incoming: any) {
  if (!incoming.length) return existing
  const seen = new Set(existing.map((m: any) => m.id))
  const added = incoming.filter((m: any) => !seen.has(m.id))
  return added.length ? [...existing, ...added] : existing
}

export function formatMsgTime(iso: any) {
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
