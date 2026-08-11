// Same-origin by default (API + React served by one Node app on cPanel).
// Override with VITE_API_URL only if API is on a different host.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

const TOKEN_KEY = 'labelpress_jwt'
const USER_KEY = 'labelpress_user'

export function getApiBase() {
  return API_BASE
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setSession(token: string, user: { id: number; username: string; role: string }) {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
}

export function getStoredUser(): { id: number; username: string; role: string } | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function isUnlocked(): boolean {
  return Boolean(getToken())
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`)
  }
  return data as T
}

export async function login(username: string, password: string) {
  const data = await request<{
    success: boolean
    token: string
    user: { id: number; username: string; role: string }
  }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  setSession(data.token, data.user)
  return data.user
}

export async function exchangeSso(ssoToken: string) {
  const data = await request<{
    success: boolean
    token: string
    user: { id: number; username: string; role: string }
  }>('/api/auth/sso/exchange', {
    method: 'POST',
    body: JSON.stringify({ ssoToken }),
  })
  setSession(data.token, data.user)
  return data.user
}

export async function fetchSettings() {
  const data = await request<{
    success: boolean
    settings: { nextSku: number; widthIn: number; heightIn: number }
  }>('/api/settings')
  return data.settings
}

export async function saveSettings(settings: {
  nextSku: number
  widthIn: number
  heightIn: number
}) {
  const data = await request<{
    success: boolean
    settings: { nextSku: number; widthIn: number; heightIn: number }
  }>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
  return data.settings
}

export async function fetchLabels() {
  const data = await request<{
    success: boolean
    items: Array<{
      id: string
      productName: string
      price: string
      code: string
      format: 'CODE128' | 'EAN13' | 'UPC'
      widthIn: number
      heightIn: number
      clientId?: string | null
    }>
  }>('/api/labels')
  return data.items.map((item) => ({
    id: item.clientId || item.id,
    productName: item.productName,
    price: item.price,
    code: item.code,
    format: item.format,
    widthIn: item.widthIn,
    heightIn: item.heightIn,
  }))
}

export async function saveBatch(payload: {
  items: unknown[]
  nextSku: number
  widthIn: number
  heightIn: number
}) {
  const data = await request<{ success: boolean; items: unknown[] }>('/api/labels/batch', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return data
}
