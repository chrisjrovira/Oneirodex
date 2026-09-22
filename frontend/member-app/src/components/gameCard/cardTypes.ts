/** The browse-row shape GameCard reads (v11 cycle, H-D.2). */

export interface CardResumeState {
  slot_name?: string | null
  updated_at?: string | null
  [key: string]: unknown
}

export interface CardGame {
  uuid: string
  name: string
  cover_url?: string | null
  url?: string | null
  steam_url?: string | null
  steam_app_id?: number | string | null
  demo_url?: string | null
  trailer_embed_url?: string | null
  play_url?: string | null
  play_blocker?: string | null
  companion_hint?: string | null
  client_connected?: boolean
  is_favorite?: boolean
  user_status?: string | null
  lifecycle_state?: string | null
  first_release_date?: string | null
  library_platform?: string | null
  library_platform_label?: string | null
  edition_platforms?: string[] | null
  genres?: string[] | null
  discover_reason?: string | null
  reason?: string | null
  badge_title_collision?: boolean
  resume_state?: CardResumeState | null
  [key: string]: unknown
}
