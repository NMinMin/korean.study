// Keep pending requests shared even when they take longer than the cache TTL.
export function createRequestCache<T>(ttlMs: number) {
  const entries = new Map<string, { promise: Promise<T>; expiresAt: number }>()
  return {
    get(key: string, load: () => Promise<T>): Promise<T> {
      const cached = entries.get(key)
      if (cached && cached.expiresAt > Date.now()) return cached.promise
      const entry = { promise: Promise.resolve().then(load), expiresAt: Infinity }
      entries.set(key, entry)
      entry.promise = entry.promise.then((value) => {
        entry.expiresAt = Date.now() + ttlMs
        return value
      }, (error) => {
        if (entries.get(key) === entry) entries.delete(key)
        throw error
      })
      return entry.promise
    },
    clear() { entries.clear() },
  }
}
