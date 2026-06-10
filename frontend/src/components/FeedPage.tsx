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
import { CheckCheckIcon, LogOutIcon, MoreIcon, SearchIcon, TrashIcon, XIcon } from './icons'

type ConnStatus = 'connected' | 'reconnecting' | 'disconnected'

const notificationAudio = new Audio(`${import.meta.env.BASE_URL.replace(/\/?$/, '')}/notification.mp3`)

function playNotificationSound() {
  notificationAudio.currentTime = 0
  notificationAudio.play().catch(() => {})
}

export function FeedPage({ onLogout }: { onLogout: () => void }) {
  const [items, setItems] = useState<Notification[]>([])
  const [cursor, setCursor] = useState<string>('')
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<Filters>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Notification[] | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [connStatus, setConnStatus] = useState<ConnStatus>('connected')
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDeleteRead, setConfirmDeleteRead] = useState(false)
  const loaderRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

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

  // SSE with reconnect
  useEffect(() => {
    let es: EventSource
    let retryCount = 0
    let retryTimer: ReturnType<typeof setTimeout>
    let destroyed = false

    function connect() {
      es = new EventSource(streamURL, { withCredentials: true })

      es.addEventListener('open', () => {
        setConnStatus('connected')
        retryCount = 0
      })

      es.addEventListener('notification', (e: MessageEvent) => {
        const n: Notification = JSON.parse(e.data)
        setItems(prev => [n, ...prev])
        setUnreadCount(c => c + 1)
        playNotificationSound()
      })

      es.onerror = () => {
        es.close()
        if (destroyed) return
        setConnStatus(retryCount === 0 ? 'reconnecting' : 'disconnected')
        const delay = Math.min(1000 * 2 ** retryCount, 30_000)
        retryCount++
        retryTimer = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      destroyed = true
      clearTimeout(retryTimer)
      es?.close()
    }
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

  // "/" focuses search (GitHub-style), Escape clears + blurs it
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Close overflow menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return
    function onClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false)
        setConfirmDeleteRead(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setConfirmDeleteRead(false)
      }
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  async function handleMarkAllRead() {
    await markAllRead()
    setItems(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  async function handleDeleteRead() {
    if (!confirmDeleteRead) {
      setConfirmDeleteRead(true)
      return
    }
    await deleteMany({ is_read: '1' })
    setItems(prev => prev.filter(n => !n.is_read))
    setMenuOpen(false)
    setConfirmDeleteRead(false)
  }

  async function handleLogout() {
    await logout()
    onLogout()
  }

  function handleMarkRead(id: string) {
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setSearchResults(prev => prev ? prev.map(n => n.id === id ? { ...n, is_read: true } : n) : null)
    setUnreadCount(c => Math.max(0, c - 1))
  }

  function handleDelete(id: string) {
    setItems(prev => prev.filter(n => n.id !== id))
    setSearchResults(prev => prev ? prev.filter(n => n.id !== id) : null)
  }

  const displayItems = searchResults ?? items

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Header — outside the scroll container so the scrollbar only spans the feed */}
      <header className="shrink-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <h1 className="text-lg font-mono font-semibold tracking-tight">
              NotiFeed
              <span className="text-blue-500 animate-[cursor-blink_1.2s_step-end_infinite]">_</span>
            </h1>
            {unreadCount > 0 && (
              <span className="bg-blue-600 text-white text-xs font-mono font-semibold rounded-full px-2 py-0.5 tabular-nums">
                {unreadCount}
              </span>
            )}
            <div
              className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
              title={`Connection: ${connStatus}`}
            >
              <div className={`w-2 h-2 rounded-full ${
                connStatus === 'connected' ? 'bg-green-500' :
                connStatus === 'reconnecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
              }`} />
              {connStatus !== 'connected' && (
                <span className="hidden sm:inline">
                  {connStatus === 'reconnecting' ? 'Reconnecting…' : 'Disconnected'}
                </span>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="flex-1 relative">
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="search"
              placeholder="Search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setSearchQuery('')
                  e.currentTarget.blur()
                }
              }}
              className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title="Clear search"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:block absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] leading-none font-mono font-medium text-gray-400 border border-gray-300 dark:border-gray-600 rounded pointer-events-none">
                /
              </kbd>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              title="Mark all as read"
            >
              <CheckCheckIcon className="w-[18px] h-[18px]" />
            </button>

            {/* Overflow menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => { setMenuOpen(o => !o); setConfirmDeleteRead(false) }}
                className={`p-2 rounded-lg transition-colors ${
                  menuOpen
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title="More actions"
              >
                <MoreIcon className="w-[18px] h-[18px]" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-1.5 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1.5 text-sm origin-top-right animate-[menu-in_0.12s_ease-out]">
                  <button
                    onClick={handleDeleteRead}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left transition-colors ${
                      confirmDeleteRead
                        ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 font-medium'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                    }`}
                  >
                    <TrashIcon className="w-4 h-4 shrink-0" />
                    {confirmDeleteRead ? 'Click again to confirm' : 'Delete read notifications'}
                  </button>
                  <div className="my-1.5 border-t border-gray-200 dark:border-gray-700" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
                  >
                    <LogOutIcon className="w-4 h-4 shrink-0" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="max-w-3xl mx-auto px-4 pb-2.5">
          <FilterBar
            filters={filters}
            unreadCount={unreadCount}
            onChange={f => { setFilters(f); setSearchQuery('') }}
          />
        </div>
      </header>


      {/* Feed — own scroll area; gutter reserved so toggling filters doesn't shift layout */}
      <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
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
    </div>
  )
}
