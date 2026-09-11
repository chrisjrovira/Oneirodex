// Ambient globals the member SPA reads off `window` / `navigator`. Declared
// here so `tsc` accepts the property access; runtime guards stay the safety net.

interface Navigator {
  userAgentData?: { mobile?: boolean; platform?: string }
}

interface YTPlayer {
  destroy?: () => void
  getPlayerState?: () => number
  getCurrentTime?: () => number
  seekTo?: (seconds: number, allowSeekAhead?: boolean) => void
}

interface YTPlayerEvent {
  data: number
}

interface YTNamespace {
  Player: new (
    element: HTMLElement | string,
    options: {
      events?: {
        onReady?: (event: YTPlayerEvent) => void
        onStateChange?: (event: YTPlayerEvent) => void
        onError?: (event: YTPlayerEvent) => void
      }
      playerVars?: Record<string, string | number | boolean>
    },
  ) => YTPlayer
  PlayerState: {
    PLAYING: number
    PAUSED: number
    ENDED: number
    BUFFERING?: number
    CUED?: number
    UNSTARTED?: number
  }
}

interface Window {
  YT?: YTNamespace
  onYouTubeIframeAPIReady?: () => void
  __odLoadingIcon?: unknown
  __odLoadingIconPending?: Promise<unknown> | null
}
