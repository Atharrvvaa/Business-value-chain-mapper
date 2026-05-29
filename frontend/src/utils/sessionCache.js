const TTL_MS = 12 * 60 * 60 * 1000
const CACHE_KEY = 'bcm:session'
const CHANGE_EVENT = 'bcm:session-change'

function dispatch() {
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function onSessionChange(handler) {
  window.addEventListener(CHANGE_EVENT, handler)
  return () => window.removeEventListener(CHANGE_EVENT, handler)
}

export function updateSession(updates) {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const existing = raw ? JSON.parse(raw) : null
    const isExpired = existing && Date.now() - existing.ts > TTL_MS
    const base = existing && !isExpired ? existing : { ts: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...base, ...updates }))
    dispatch()
  } catch {}
}

export function resetSession(updates) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), ...updates }))
    dispatch()
  } catch {}
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const item = JSON.parse(raw)
    if (Date.now() - item.ts > TTL_MS) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
    return item
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(CACHE_KEY)
  dispatch()
}

export function getExpiresAt() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const item = JSON.parse(raw)
    if (Date.now() - item.ts > TTL_MS) return null
    return new Date(item.ts + TTL_MS)
  } catch {
    return null
  }
}

export function savePage(page) {
  updateSession({ page })
}
