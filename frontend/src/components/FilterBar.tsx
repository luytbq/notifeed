import type { Filters } from '../types'
import { ChevronDownIcon, XIcon } from './icons'

const levels = ['info', 'warning', 'error', 'critical']

export function FilterBar({
  filters,
  unreadCount,
  onChange,
}: {
  filters: Filters
  unreadCount: number
  onChange: (f: Filters) => void
}) {
  function set(key: keyof Filters, value: string | undefined) {
    onChange({ ...filters, [key]: value || undefined })
  }

  const unreadOnly = filters.is_read === '0'
  const segmentBase = 'px-3 py-1 rounded-md text-sm font-medium transition-colors'
  const segmentOn = 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
  const segmentOff = 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'

  return (
    <div className="flex gap-2 flex-wrap items-center">
      {/* All / Unread segmented control */}
      <div className="inline-flex items-center gap-0.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 p-0.5">
        <button
          onClick={() => set('is_read', undefined)}
          className={`${segmentBase} ${unreadOnly ? segmentOff : segmentOn}`}
        >
          All
        </button>
        <button
          onClick={() => set('is_read', '0')}
          className={`${segmentBase} ${unreadOnly ? segmentOn : segmentOff}`}
        >
          Unread
          {unreadCount > 0 && (
            <span className={`ml-1.5 text-xs tabular-nums ${
              unreadOnly ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
            }`}>
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Level filter */}
      <div className="relative">
        <select
          value={filters.level ?? ''}
          onChange={e => set('level', e.target.value)}
          className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg text-sm border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            filters.level
              ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-medium'
              : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <option value="">All levels</option>
          {levels.map(l => (
            <option key={l} value={l}>{l[0].toUpperCase() + l.slice(1)}</option>
          ))}
        </select>
        <ChevronDownIcon className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>

      {/* Source filter */}
      <input
        type="text"
        placeholder="Source"
        value={filters.source ?? ''}
        onChange={e => set('source', e.target.value)}
        className={`px-3 py-1.5 rounded-lg text-sm border w-28 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          filters.source
            ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-medium'
            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/60 text-gray-600 dark:text-gray-300'
        }`}
      />

      {/* Reset */}
      {(filters.is_read !== undefined || filters.level || filters.source) && (
        <button
          onClick={() => onChange({})}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
        >
          <XIcon className="w-3.5 h-3.5" />
          Clear
        </button>
      )}
    </div>
  )
}
