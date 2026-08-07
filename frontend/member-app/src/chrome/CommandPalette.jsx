import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Command } from 'cmdk'
import { useLocation, useNavigate } from 'react-router-dom'
import { searchGames } from '../api/collections'
import { openPreferencesModal } from '../api/preferences'
import { requestOpenChatPanel } from '../hooks/chatPanelApi'
import { requestOpenSocialCompanion } from '../hooks/socialCompanionApi'
import { getMoreLinks, getPrimaryLinks } from './navConfig'
import './CommandPalette.css'

/**
 * Build unique command entries from nav config + Preferences action.
 * @param {{ isAdmin?: boolean, showTrailers?: boolean, showHelp?: boolean, enableVr?: boolean }} shellConfig
 */
export function buildPaletteCommands(shellConfig = {}) {
  const {
    isAdmin = false,
    showTrailers = false,
    showHelp = false,
    enableVr = false,
    enableActivity = true,
  } = shellConfig

  const seen = new Set()
  const commands = []

  function push(cmd) {
    if (!cmd?.id || seen.has(cmd.id)) return
    seen.add(cmd.id)
    commands.push(cmd)
  }

  for (const link of getPrimaryLinks()) {
    push({
      id: link.id,
      label: link.label,
      to: link.to,
      href: link.href,
      external: Boolean(link.external),
      group: 'Navigate',
    })
  }

  if (isAdmin) {
    push({
      id: 'admin',
      label: 'Admin',
      href: '/admin/dashboard',
      external: true,
      group: 'Navigate',
    })
  }

  for (const link of getMoreLinks({ showTrailers, showHelp, enableVr, enableActivity })) {
    push({
      id: link.id,
      label: link.label,
      to: link.to,
      href: link.href,
      action: link.action,
      external: Boolean(link.external),
      group: 'More',
    })
  }

  push({
    id: 'preferences',
    label: 'Preferences',
    action: 'preferences',
    group: 'Account',
  })
  push({
    id: 'tokens',
    label: 'API tokens',
    to: '/tokens',
    group: 'Account',
  })

  return commands
}

/**
 * True when Cmd+K should prioritize library title search.
 * @param {string} pathname
 */
export function isLibrarySearchRoute(pathname = '') {
  return pathname === '/library' || pathname.startsWith('/library/')
}

/**
 * Ctrl/Cmd+K command palette for primary + More nav jumps and Preferences.
 * On Library routes, title search is primary; nav categories remain available.
 */
export function CommandPalette({
  shellConfig = {},
  open: openProp,
  onOpenChange,
  defaultOpen = false,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const libraryMode = isLibrarySearchRoute(location.pathname)
  const controlled = openProp !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const open = controlled ? openProp : uncontrolledOpen
  const openRef = useRef(open)
  openRef.current = open

  const [query, setQuery] = useState('')
  const [libraryHits, setLibraryHits] = useState([])
  const [libraryStatus, setLibraryStatus] = useState('idle') // idle | loading | ready | error

  const setOpen = useCallback(
    (next) => {
      const value = typeof next === 'function' ? next(openRef.current) : next
      if (!controlled) setUncontrolledOpen(value)
      onOpenChange?.(value)
    },
    [controlled, onOpenChange],
  )

  const commands = useMemo(() => buildPaletteCommands(shellConfig), [shellConfig])

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [setOpen])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setLibraryHits([])
      setLibraryStatus('idle')
    }
  }, [open])

  useEffect(() => {
    if (!open || !libraryMode) {
      return undefined
    }
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setLibraryHits([])
      setLibraryStatus('idle')
      return undefined
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLibraryStatus('loading')
      searchGames(trimmed, { signal: controller.signal, limit: 12 })
        .then((rows) => {
          setLibraryHits(Array.isArray(rows) ? rows : [])
          setLibraryStatus('ready')
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return
          setLibraryHits([])
          setLibraryStatus('error')
        })
    }, 220)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, libraryMode, query])

  async function runCommand(cmd) {
    setOpen(false)
    if (cmd.action === 'preferences') {
      try {
        await openPreferencesModal()
      } catch {
        window.location.href = '/settings_panel'
      }
      return
    }
    if (cmd.action === 'open-friends') {
      requestOpenSocialCompanion()
      return
    }
    if (cmd.action === 'open-chat') {
      requestOpenChatPanel()
      return
    }
    if (cmd.external || cmd.href) {
      window.location.href = cmd.href
      return
    }
    if (cmd.to) {
      navigate(cmd.to)
    }
  }

  const groups = useMemo(() => {
    const map = new Map()
    for (const cmd of commands) {
      const list = map.get(cmd.group) || []
      list.push(cmd)
      map.set(cmd.group, list)
    }
    return [...map.entries()]
  }, [commands])

  const showLibraryGroup = libraryMode && query.trim().length >= 2

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="gt-cmdk"
      overlayClassName="gt-cmdk__overlay"
      contentClassName="gt-cmdk__content"
      loop
    >
      <Command.Input
        className="gt-cmdk__input"
        placeholder={libraryMode ? 'Search library…' : 'Search pages…'}
        value={query}
        onValueChange={setQuery}
        autoFocus
      />
      <Command.List className="gt-cmdk__list">
        <Command.Empty className="gt-cmdk__empty">
          {libraryMode && libraryStatus === 'loading'
            ? 'Searching library…'
            : libraryMode && libraryStatus === 'error'
              ? 'Library search failed.'
              : libraryMode && showLibraryGroup && libraryHits.length === 0
                ? 'No matching library titles.'
                : 'No matching commands.'}
        </Command.Empty>

        {showLibraryGroup && libraryHits.length > 0 ? (
          <Command.Group heading="Search library" className="gt-cmdk__group">
            {libraryHits.map((hit) => {
              const uuid = hit.uuid || hit.id
              const name = hit.name || 'Untitled'
              return (
                <Command.Item
                  key={`lib-${uuid}`}
                  value={`library ${name} ${uuid}`}
                  keywords={[name, String(uuid)]}
                  className="gt-cmdk__item"
                  onSelect={() => {
                    setOpen(false)
                    navigate(`/game_details/${encodeURIComponent(uuid)}`)
                  }}
                >
                  <span className="gt-cmdk__item-label">{name}</span>
                  <span className="gt-cmdk__item-hint">Open details</span>
                </Command.Item>
              )
            })}
          </Command.Group>
        ) : null}

        {groups.map(([heading, items]) => (
          <Command.Group key={heading} heading={heading} className="gt-cmdk__group">
            {items.map((cmd) => (
              <Command.Item
                key={cmd.id}
                value={`${cmd.label} ${cmd.id}`}
                keywords={[cmd.label, cmd.id, cmd.to, cmd.href].filter(Boolean)}
                className="gt-cmdk__item"
                onSelect={() => {
                  void runCommand(cmd)
                }}
              >
                <span className="gt-cmdk__item-label">{cmd.label}</span>
                {cmd.to || cmd.href ? (
                  <span className="gt-cmdk__item-hint">{cmd.to || cmd.href}</span>
                ) : null}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>
    </Command.Dialog>
  )
}
