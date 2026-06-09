import type { Filters } from '../types'

const levels = ['info', 'warning', 'error', 'critical']

export function FilterBar({
  filters,
  onChange,
}: {
  filters: Filters
  onChange: (f: Filters) => void
}) {
  function set(key: keyof Filters, value: string | undefined) {
    onChange({ ...filters, [key]: value || undefined })
  }

  return (
    <div className="flex gap-2 flex-wrap items-center">
      {/* Unread toggle */}
      <button
        onClick={() => set('is_read', filters.is_read === '0' ? undefined : '0')}
        className={`px-3 py-1 rounded-full text-sm border transition-colors ${
          filters.is_read === '0'
            ? 'bg-blue-600 text-white border-blue-600'
            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
      >
        Unread
      </button>

      {/* Level filter */}
      <select
        value={filters.level ?? ''}
        onChange={e => set('level', e.target.value)}
        className="px-3 py-1 rounded-full text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
      >
        <option value="">All levels</option>
        {levels.map(l => (
          <option key={l} value={l}>{l}</option>
        ))}
      </select>

      {/* Source filter */}
      <input
        type="text"
        placeholder="Source…"
        value={filters.source ?? ''}
        onChange={e => set('source', e.target.value)}
        className="px-3 py-1 rounded-full text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 w-28 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      {/* Reset */}
      {(filters.is_read !== undefined || filters.level || filters.source) && (
        <button
          onClick={() => onChange({})}
          className="px-3 py-1 rounded-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
        >
          Clear
        </button>
      )}
    </div>
  )
}
