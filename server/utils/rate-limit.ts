import type { H3Event } from 'h3'

const hits = new Map<string, number[]>()

/**
 * Allows `limit` requests per IP address and `key` within `windowMs`.
 *
 * Kept in memory, so it only counts per server instance. That is enough to
 * slow down a single script hammering a form, not to stop a distributed attack.
 */
export function checkRateLimit(event: H3Event, key: string, limit: number, windowMs: number): boolean {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const id = `${key}:${ip}`
  const now = Date.now()
  const recent = (hits.get(id) ?? []).filter(time => now - time < windowMs)

  if (recent.length >= limit) {
    hits.set(id, recent)
    return false
  }

  recent.push(now)
  hits.set(id, recent)

  // Drop stale entries now and then, so the map does not grow forever.
  if (hits.size > 5000) {
    for (const [entry, times] of hits) {
      if (times.every(time => now - time >= windowMs))
        hits.delete(entry)
    }
  }
  return true
}
