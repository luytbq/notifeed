import { useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteMany,
  listNotifications,
  logout,
  markAllRead,
  search as searchAPI,
  streamURL,
} from '../api'
import type { Filters, Notification } from '../types'
import { FilterBar } from './FilterBar'
import { NotificationItem } from './NotificationItem'

export function FeedPage({ onLogout }: { onLogout: () => void }) {
  const [items, setItems] = useState<Notification[]>([])
  const [cursor, setCursor] = useState<string>('')
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<Filters>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Notification[] | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const loaderRef = useRef<HTMLDivElement>(null)

  const load = useCallback(
    async (reset = false) => {
      setLoading(true)
      try {
        const before = reset ? undefined : cursor || undefined
        const data = await listNotifications(filters, before)
        setItems(prev => (reset ? data.items : [...prev, ...data.items]))
        setCursor(data.next_cursor)
        setHasMore(!!data.next_cursor)
      } finally {
        setLoading(false)
      }
    },
    [filters, cursor],
  )

  // Reset on filter change
  useEffect(() => {
    setItems([])
    setCursor('')
    const run = async () => {
      setLoading(true)
      try {
        const data = await listNotifications(filters)
        setItems(data.items)
        setCursor(data.next_cursor)
        setHasMore(!!data.next_cursor)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [filters])

  // Count unread
  useEffect(() => {
    setUnreadCount(items.filter(n => !n.is_read).length)
  }, [items])

  // SSE
  useEffect(() => {
    const es = new EventSource(streamURL, { withCredentials: true })
    es.addEventListener('notification', (e: MessageEvent) => {
      const n: Notification = JSON.parse(e.data)
      setItems(prev => [n, ...prev])
      setUnreadCount(c => c + 1)
    })
    return () => es.close()
  }, [])

  // Infinite scroll
  useEffect(() => {
    if (!loaderRef.current) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        load(false)
      }
    })
    obs.observe(loaderRef.current)
    return () => obs.disconnect()
  }, [hasMore, loading, load])

  // Search debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    const t = setTimeout(async () => {
      const data = await searchAPI(searchQuery)
      setSearchResults(data.items)
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  async function handleMarkAllRead() {
    await markAllRead()
    setItems(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  async function handleDeleteRead() {
    await deleteMany({ is_read: '1' })
    setItems(prev => prev.filter(n => !n.is_read))
  }

  async function handleLogout() {
    await logout()
    onLogout()
  }

  function handleMarkRead(id: string) {
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
  }

  function handleDelete(id: string) {
    setItems(prev => prev.filter(n => n.id !== id))
  }

  const displayItems = searchResults ?? items

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <h1 className="text-lg font-semibold">
            NotiFeed
            {unreadCount > 0 && (
              <span className="ml-2 bg-blue-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
                {unreadCount}
              </span>
            )}
          </h1>

          {/* Search */}
          <input
            type="search"
            placeholder="Search…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleMarkAllRead}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors whitespace-nowrap"
              title="Mark all notifications as read"
            >
              ✓ Mark all read
            </button>
            <button
              onClick={handleDeleteRead}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900 transition-colors whitespace-nowrap"
              title="Delete all read notifications"
            >
              🗑 Delete read
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="max-w-3xl mx-auto px-4 pb-3">
          <FilterBar filters={filters} onChange={f => { setFilters(f); setSearchQuery('') }} />
        </div>
      </header>

      {/* Feed */}
      <main className="max-w-3xl mx-auto px-4 py-4 space-y-2">
        {searchResults !== null && searchResults.length > 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;
          </p>
        )}

        {displayItems.length === 0 && !loading && (
          <div className="text-center py-20 text-gray-400 dark:text-gray-500">
            {searchResults !== null
              ? `No results for "${searchQuery}"`
              : filters.is_read === '0'
                ? '✓ All caught up — no unread notifications'
                : (filters.level || filters.source)
                  ? 'No notifications match your filters'
                  : 'No notifications yet'}
          </div>
        )}

        {displayItems.map(item => (
          <NotificationItem key={item.id} item={item} onMarkRead={handleMarkRead} onDelete={handleDelete} />
        ))}

        {/* Infinite scroll sentinel */}
        {searchResults === null && (
          <div ref={loaderRef} className="py-4 text-center text-gray-400 text-sm">
            {loading ? 'Loading…' : hasMore ? '' : items.length > 0 ? 'All caught up' : ''}
          </div>
        )}
      </main>
    </div>
  )
}
