import type { Filters, ListResponse, Notification } from './types'

async function req(method: string, path: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res
}

export async function login(password: string) {
  await req('POST', '/api/login', { password })
}

export async function logout() {
  await req('POST', '/api/logout')
}

export async function listNotifications(filters: Filters, before?: string, limit = 50): Promise<ListResponse> {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  if (before) params.set('before', before)
  if (filters.is_read !== undefined) params.set('is_read', filters.is_read)
  if (filters.source) params.set('source', filters.source)
  if (filters.level) params.set('level', filters.level)
  const res = await req('GET', `/api/notifications?${params}`)
  return res.json()
}

export async function markRead(id: string) {
  await req('PATCH', `/api/notifications/${id}/read`)
}

export async function markAllRead() {
  await req('PATCH', '/api/notifications/read-all')
}

export async function deleteOne(id: string) {
  await req('DELETE', `/api/notifications/${id}`)
}

export async function deleteMany(filters: Filters) {
  const params = new URLSearchParams()
  if (filters.is_read !== undefined) params.set('is_read', filters.is_read)
  if (filters.source) params.set('source', filters.source)
  if (filters.level) params.set('level', filters.level)
  await req('DELETE', `/api/notifications?${params}`)
}

export async function search(q: string, limit = 50): Promise<{ items: Notification[] }> {
  const params = new URLSearchParams({ q, limit: String(limit) })
  const res = await req('GET', `/api/notifications/search?${params}`)
  return res.json()
}
