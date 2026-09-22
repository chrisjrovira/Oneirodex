import type { FormEvent } from 'react'
import type { ChatChannel, ChatSearchHit } from './chatTypes'
import { PageStatus } from '../PageStatus'
import { SpaceRail } from '../SpaceRail'
import { Button } from '@oneirodex/ui'

/** The rooms column: header + tools, search hits, DM / room lists, the space rail, create-room. */
export function ChatRoomsAside({
  activeId,
  canCreateRooms,
  channels,
  channelsLoading,
  createRoom,
  creatingRoom,
  dmChannels,
  dmName,
  loadChannels,
  newRoomName,
  openDm,
  roomChannels,
  runSearch,
  searchHits,
  searchQ,
  setActiveId,
  setDmName,
  setNewRoomName,
  setPreferScreenshare,
  setSearchHits,
  setSearchQ,
  setShowTools,
  setVoiceChannel,
  setVoiceOpen,
  showTools,
}: {
  activeId: number | string | null
  canCreateRooms: boolean
  channels: ChatChannel[]
  channelsLoading: boolean
  createRoom: (event: FormEvent<HTMLFormElement>) => Promise<void>
  creatingRoom: boolean
  dmChannels: ChatChannel[]
  dmName: string
  loadChannels: () => Promise<void>
  newRoomName: string
  openDm: (event: FormEvent<HTMLFormElement>) => Promise<void>
  roomChannels: ChatChannel[]
  runSearch: (event: FormEvent<HTMLFormElement>) => Promise<void>
  searchHits: ChatSearchHit[]
  searchQ: string
  setActiveId: (id: number | string | null) => void
  setDmName: (value: string) => void
  setNewRoomName: (value: string) => void
  setPreferScreenshare: (value: boolean) => void
  setSearchHits: (hits: ChatSearchHit[]) => void
  setSearchQ: (value: string) => void
  setShowTools: (update: boolean | ((open: boolean) => boolean)) => void
  setVoiceChannel: (channel: ChatChannel | null) => void
  setVoiceOpen: (value: boolean) => void
  showTools: boolean
}) {
  return (
    <aside className="od-chat-channels" aria-label="Rooms">
      <div className="od-chat-channels__head">
        <h2>Rooms</h2>
        <button
          type="button"
          className="od-chat-icon-btn"
          aria-expanded={showTools}
          aria-controls="od-chat-tools"
          onClick={() => setShowTools((v) => !v)}
          title={showTools ? 'Hide search & DM' : 'Search & DM'}
        >
          {showTools ? 'Less' : 'More'}
        </button>
      </div>

      {showTools ? (
        <div id="od-chat-tools" className="od-chat-tools">
          <form className="od-chat-tool-form" onSubmit={runSearch}>
            <label className="od-chat-sr-only" htmlFor="od-chat-search">
              Search messages
            </label>
            <input
              id="od-chat-search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search messages"
              autoComplete="off"
            />
            <Button className="od-btn--secondary" type="submit">
              Go
            </Button>
          </form>
          <form className="od-chat-tool-form" onSubmit={openDm}>
            <label className="od-chat-sr-only" htmlFor="od-chat-dm">
              Direct message
            </label>
            <input
              id="od-chat-dm"
              value={dmName}
              onChange={(e) => setDmName(e.target.value)}
              placeholder="DM username"
              autoComplete="off"
            />
            <Button className="od-btn--secondary" type="submit">
              Open
            </Button>
          </form>
        </div>
      ) : null}

      {searchHits.length > 0 ? (
        <ul className="od-chat-search-hits">
          {searchHits.map((hit) => (
            <li key={`${hit.channel?.id}-${hit.message?.id}`}>
              <button
                type="button"
                className="od-chat-search-hit"
                onClick={() => {
                  if (hit.channel?.id) setActiveId(hit.channel.id)
                  setSearchHits([])
                  setShowTools(false)
                }}
              >
                <span className="od-chat-search-hit__ch">{hit.channel?.name}</span>
                <span className="od-chat-search-hit__body">
                  {hit.message?.user}: {hit.message?.body}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {channelsLoading ? (
        <PageStatus loading inline loadingMessage="Loading rooms…" />
      ) : channels.length === 0 ? (
        <PageStatus emptyMessage="No rooms yet — #general appears after first visit when chat is seeded." />
      ) : (
        <div className="od-chat-channel-groups">
          {roomChannels.length > 0 ? (
            <>
              <p className="od-chat-channel-label">Channels</p>
              <ul className="od-chat-channel-list" aria-label="Channels">
                {roomChannels.map((ch) => (
                  <li key={ch.id}>
                    <button
                      type="button"
                      className={`od-chat-channel${ch.muted ? ' is-muted' : ''}${ch.id === activeId ? ' is-active' : ''}`}
                      onClick={() => setActiveId(ch.id)}
                      aria-pressed={ch.id === activeId}
                    >
                      <span className="od-chat-channel__hash" aria-hidden="true">
                        #
                      </span>
                      <span className="od-chat-channel__name">
                        {ch.name?.replace(/^#/, '') || ch.name}
                      </span>
                      {ch.unread ? (
                        <span
                          className="od-chat-channel__unread"
                          aria-label={`${ch.unread} unread`}
                        >
                          {ch.unread > 99 ? '99+' : ch.unread}
                        </span>
                      ) : null}
                      {ch.muted ? <span className="od-chat-channel__muted">muted</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {dmChannels.length > 0 ? (
            <>
              <p className="od-chat-channel-label">Direct</p>
              <ul className="od-chat-channel-list" aria-label="Direct messages">
                {dmChannels.map((ch) => (
                  <li key={ch.id}>
                    <button
                      type="button"
                      className={`od-chat-channel${ch.muted ? ' is-muted' : ''}${ch.id === activeId ? ' is-active' : ''}`}
                      onClick={() => setActiveId(ch.id)}
                      aria-pressed={ch.id === activeId}
                    >
                      <span className="od-chat-channel__hash" aria-hidden="true">
                        @
                      </span>
                      <span className="od-chat-channel__name">{ch.name}</span>
                      {ch.unread ? (
                        <span
                          className="od-chat-channel__unread"
                          aria-label={`${ch.unread} unread`}
                        >
                          {ch.unread > 99 ? '99+' : ch.unread}
                        </span>
                      ) : null}
                      {ch.muted ? <span className="od-chat-channel__muted">muted</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      )}

      <SpaceRail
        activeChannelId={activeId}
        onSelectTextChannel={(channel: any) => {
          setActiveId(channel.id)
          void loadChannels()
        }}
        onSelectVoiceChannel={(channel: any) => {
          setVoiceChannel(channel)
          setPreferScreenshare(false)
          setVoiceOpen(true)
        }}
        onJoined={() => void loadChannels()}
      />

      {canCreateRooms ? (
        <form className="od-chat-create-room" onSubmit={createRoom}>
          <label className="od-chat-sr-only" htmlFor="od-chat-new-room">
            New room name
          </label>
          <input
            id="od-chat-new-room"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="New room"
            autoComplete="off"
            disabled={creatingRoom}
          />
          <Button type="submit" disabled={creatingRoom || !newRoomName.trim()}>
            Add
          </Button>
        </form>
      ) : (
        <p className="od-chat-create-hint">
          Ask a household member to create a room (child accounts cannot).
        </p>
      )}
    </aside>
  )
}
