import type { Notification } from '../types'
import { markRead, deleteOne } from '../api'

const levelStyle: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  critical: 'bg-red-200 text-red-900 font-bold dark:bg-red-800 dark:text-red-100',
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function NotificationItem({
  item,
  onUpdate,
}: {
  item: Notification
  onUpdate: () => void
}) {
  async function handleMarkRead() {
    if (item.is_read) return
    await markRead(item.id)
    onUpdate()
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    await deleteOne(item.id)
    onUpdate()
  }

  return (
    <div
      onClick={handleMarkRead}
      className={`group flex gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
        item.is_read
          ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 opacity-60'
          : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`text-xs px-2 py-0.5 rounded-full ${levelStyle[item.level] ?? levelStyle.info}`}>
            {item.level}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{item.source}</span>
          {item.origin && (
            <span className="text-xs text-gray-400 dark:text-gray-500">· {item.origin}</span>
          )}
          {!item.is_read && (
            <span className="ml-auto w-2 h-2 rounded-full bg-blue-500 shrink-0" />
          )}
        </div>
        <p className="font-medium text-gray-900 dark:text-white truncate">{item.title}</p>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-2">{item.message}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{formatTime(item.created_at)}</p>
      </div>
      <button
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 shrink-0 px-1"
        title="Delete"
      >
        ✕
      </button>
    </div>
  )
}
