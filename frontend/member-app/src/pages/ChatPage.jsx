import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestOpenChatPanel } from '../hooks/chatPanelApi'

/**
 * `/chat` deep-link — opens the left slide-out and returns to library so TopNav + page stay.
 */
export function ChatPage() {
  const navigate = useNavigate()

  useEffect(() => {
    requestOpenChatPanel()
    navigate('/library', { replace: true })
  }, [navigate])

  return <p className="gt-more-page__lede">Opening chat…</p>
}

// Re-export panel for any direct import / tests that still target page module.
export { ChatPanel } from '../components/ChatPanel'
