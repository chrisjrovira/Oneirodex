/** The news payloads as NewsPage and its sections read them (H-D.2). */

export interface NewsItem {
  id: number | string
  title?: string | null
  body?: string | null
  summary?: string | null
  description?: string | null
  url?: string | null
  store_url?: string | null
  claim_url?: string | null
  image_url?: string | null
  source?: string | null
  store?: string | null
  external_id?: string | null
  worth?: string | null
  connected?: boolean
  ends_at?: string | null
  published_at?: string | null
  created_at?: string | null
  links?: { https?: string | null; protocol?: string | null } | null
  [key: string]: unknown
}

export interface FeaturedNews {
  kind: 'admin' | 'headline' | 'free'
  item: NewsItem
}
