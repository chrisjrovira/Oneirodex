import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChatPanel } from '../components/ChatPanel'
import { isPopoutWindow, requestOpenChatPanel } from '../hooks/chatPanelApi'
import './ChatPage.css'

/** `?channel=12` on the pop-out URL, as a number when it is one. */
function channelFromLocation() {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('channel')
  if (!raw) return null
  const asNumber = Number(raw)
  return Number.isFinite(asNumber) ? asNumber : raw
}

/**
 * `/chat` — two different surfaces, decided by `?popout=1`.
 *
 * **In the main window** it is a deep link: open the slide-out over whatever
 * you were doing and put you back on the library. Chat is a companion to
 * browsing, so a full-page takeover would be the wrong shape.
 *
 * **In a pop-out** it is the whole application. This is the bug that made the
 * pop-out "a minimised version of the site": the redirect below ran there too,
 * and `navigate('/library')` drops the query string — so the pop-out lost its
 * `popout=1`, the shell decided it was an ordinary window, and a 420px frame
 * rendered the rail, the top bar and the library grid with the chat panel
 * sliding over the top of them. The pop-out now renders the panel and nothing
 * else, which is what a pop-out is for.
 */
export function ChatPage({ shellConfig = {} } = {}) {
  const navigate = useNavigate()
  const popout = isPopoutWindow()

  useEffect(() => {
    if (popout) return
    requestOpenChatPanel()
    navigate('/library', { replace: true })
  }, [navigate, popout])

  if (!popout) {
    return <p className="od-more-page__lede">Opening chat…</p>
  }

  return (
    <div className="od-chat-standalone">
      <ChatPanel
        initialChannelId={channelFromLocation()}
        // Admins create rooms and librarians are allowed by the API; the UI
        // shows the form either way and surfaces the 403, same as the dock.
        canCreateRooms
        viewer={{
          userId: shellConfig.userId ?? null,
          isLibrarian: Boolean(shellConfig.isLibrarian),
          isAdmin: Boolean(shellConfig.isAdmin),
          role: shellConfig.role || 'user',
        }}
        // No `onClose`: closing is what the window's own close button does.
        // A second dismiss inside a dedicated window is a control that either
        // does nothing or leaves an empty frame behind.
        expanded
      />
    </div>
  )
}

// Re-export panel for any direct import / tests that still target page module.
export { ChatPanel } from '../components/ChatPanel'
