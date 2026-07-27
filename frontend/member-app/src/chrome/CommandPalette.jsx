import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router-dom'
import { openPreferencesModal } from '../api/preferences'
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
  } = shellConfig

  const seen = new Set()
  const commands = []

  function push(cmd) {
    if (!cmd?.id || seen.has(cmd.id)) return
    seen.add(cmd.id)
    commands.push(cmd)
  }

  for (const link of getPrimaryLinks()) {
    if (link.id === 'admin' && !isAdmin) continue
    push({
      id: link.id,
      label: link.label,
      to: link.to,
      href: link.href,
      external: Boolean(link.external),
      group: 'Navigate',
    })
  }

  for (const link of getMoreLinks({ showTrailers, showHelp, enableVr })) {
    push({
      id: link.id,
      label: link.label,
      to: link.to,
      href: link.href,
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

  return commands
}

/**
 * Ctrl/Cmd+K command palette for primary + More nav jumps and Preferences.
 */
export function CommandPalette({
  shellConfig = {},
  open: openProp,
  onOpenChange,
  defaultOpen = false,
}) {
  const navigate = useNavigate()
  const controlled = openProp !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const open = controlled ? openProp : uncontrolledOpen
  const openRef = useRef(open)
  openRef.current = open

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
        placeholder="Search pages…"
        autoFocus
      />
      <Command.List className="gt-cmdk__list">
        <Command.Empty className="gt-cmdk__empty">No matching commands.</Command.Empty>
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
