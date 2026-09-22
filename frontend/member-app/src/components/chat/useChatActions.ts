import { useState, type ChangeEvent } from 'react'
import { confirmAction } from '@oneirodex/ui'
import {
  archiveChatChannel,
  leaveChatChannel,
  muteChatChannel,
  uploadChatAttachment,
} from '../../api/chat'
import { canArchiveChannel, canLeaveChannel, normalizeAttachments } from '../../hooks/chatPanelApi'
import {
  ATTACH_HINT_CHILD,
  ATTACH_HINT_UNAVAILABLE,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from './chatHelpers'
import type { ChatAttachment, ChatChannel, ChatMessage } from './chatTypes'

/* Handlers pulled out of ChatPanel (v11 cycle, H-D.2). Bodies unchanged; the
 * state each one owns moved with it. */

export type ShowStatus = (text: string | null, options?: { isError?: boolean }) => void

/** Mute / archive / leave for the active room. */
export function useRoomActions({
  activeId,
  channels,
  setChannels,
  viewer,
  setMessages,
  setReplyTo,
  loadChannels,
  showStatus,
}: {
  activeId: number | string | null
  channels: ChatChannel[]
  setChannels: (update: (prev: ChatChannel[]) => ChatChannel[]) => void
  viewer: { role?: string | null; [key: string]: unknown }
  setMessages: (rows: ChatMessage[]) => void
  setReplyTo: (message: ChatMessage | null) => void
  loadChannels: () => Promise<void>
  showStatus: ShowStatus
}) {
  const [roomActionBusy, setRoomActionBusy] = useState(false)

  async function toggleMute() {
    if (!activeId) return
    const current = channels.find((c) => c.id === activeId)
    if (!current) return
    const nextMuted = !current.muted
    const result = await muteChatChannel(activeId, nextMuted)
    if (!result.ok) {
      showStatus(result.error, { isError: true })
      return
    }
    setChannels((prev) =>
      prev.map((ch) => (ch.id === activeId ? { ...ch, muted: Boolean(result.data?.muted) } : ch)),
    )
    showStatus(null)
  }

  async function archiveActiveRoom() {
    if (!activeId || roomActionBusy) return
    const current = channels.find((c) => c.id === activeId)
    if (!current || !canArchiveChannel(current, viewer)) return
    const label = current.name?.replace(/^#/, '') || current.name || 'this room'
    const ok = await confirmAction({
      title: `Archive #${label}?`,
      body: 'It disappears for everyone, not just you.',
      confirmLabel: 'Archive room',
      cancelLabel: 'Keep it',
    })
    if (!ok) return
    setRoomActionBusy(true)
    showStatus(null)
    try {
      const result = await archiveChatChannel(activeId)
      if (!result.ok) {
        if (result.status === 403) {
          showStatus(result.data?.error || 'You don’t have permission to archive this room', {
            isError: true,
          })
        } else {
          showStatus(result.error, { isError: true })
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
    const ok = await confirmAction({
      title: isDm ? `Leave conversation with ${label}?` : `Leave #${label}?`,
      body: isDm
        ? 'You can open a new DM later.'
        : 'This mutes the room (same as Mute). You can unmute later.',
      confirmLabel: isDm ? 'Leave conversation' : 'Leave room',
      cancelLabel: 'Stay',
      // Leaving is reversible — an unmute or a new DM away — so it does not
      // get the danger treatment that archiving does.
      tone: 'neutral',
    })
    if (!ok) return
    setRoomActionBusy(true)
    showStatus(null)
    try {
      const result = await leaveChatChannel(activeId)
      if (!result.ok) {
        if (result.status === 403) {
          showStatus(result.data?.error || 'You don’t have permission to leave this room', {
            isError: true,
          })
        } else {
          showStatus(result.error, { isError: true })
        }
        return
      }
      if (isDm) {
        setMessages([])
        setReplyTo(null)
      } else {
        const mutedAfterLeave = typeof result.data?.muted === 'boolean' ? result.data.muted : true
        setChannels((prev) =>
          prev.map((ch) => (ch.id === leftId ? { ...ch, muted: mutedAfterLeave } : ch)),
        )
      }
      await loadChannels()
    } finally {
      setRoomActionBusy(false)
    }
  }

  return { roomActionBusy, toggleMute, archiveActiveRoom, leaveActiveRoom }
}

/** The file input handler: probes availability, enforces the per-message cap, uploads in order. */
export function useAttachmentUpload({
  activeId,
  viewerIsChild,
  pendingAttachments,
  setPendingAttachments,
  showStatus,
}: {
  activeId: number | string | null
  viewerIsChild: boolean
  pendingAttachments: ChatAttachment[]
  setPendingAttachments: (update: (prev: ChatAttachment[]) => ChatAttachment[]) => void
  showStatus: ShowStatus
}) {
  const [attachAvailable, setAttachAvailable] = useState<boolean | null>(null)
  const [attachBusy, setAttachBusy] = useState(false)

  async function handleAttachFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length || !activeId) return
    if (viewerIsChild) {
      setAttachAvailable(false)
      showStatus(ATTACH_HINT_CHILD, { isError: true })
      return
    }
    if (attachAvailable === false) {
      showStatus(ATTACH_HINT_UNAVAILABLE, { isError: true })
      return
    }
    const roomLeft = MAX_ATTACHMENTS_PER_MESSAGE - pendingAttachments.length
    if (roomLeft <= 0) {
      showStatus(`Max ${MAX_ATTACHMENTS_PER_MESSAGE} attachments per message`, { isError: true })
      return
    }
    setAttachBusy(true)
    showStatus(null)
    try {
      for (const file of files.slice(0, roomLeft)) {
        const result = await uploadChatAttachment(activeId, file)
        if (result.unavailable) {
          setAttachAvailable(false)
          showStatus(ATTACH_HINT_UNAVAILABLE, { isError: true })
          return
        }
        if (!result.ok) {
          if (result.status === 403) {
            setAttachAvailable(false)
            showStatus(result.error || ATTACH_HINT_CHILD, { isError: true })
            return
          }
          showStatus(result.error || 'Upload failed', { isError: true })
          return
        }
        const normalized = normalizeAttachments([result.attachment])[0]
        if (normalized) {
          setPendingAttachments((prev) => [...prev, normalized])
          setAttachAvailable(true)
        }
      }
    } finally {
      setAttachBusy(false)
    }
  }

  return { attachAvailable, setAttachAvailable, attachBusy, handleAttachFiles }
}
