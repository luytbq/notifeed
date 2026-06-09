export type Level = 'info' | 'warning' | 'error' | 'critical'

export interface Notification {
  id: string
  source: string
  title: string
  message: string
  level: Level
  channel: string
  origin?: string
  is_read: boolean
  created_at: string
  received_at: string
}

export interface ListResponse {
  items: Notification[]
  next_cursor: string
}

export interface Filters {
  is_read?: '0' | '1'
  source?: string
  level?: string
}
