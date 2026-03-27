const searchCache = new Map<string, { result: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function getCachedSearch(query: string) {
  const cached = searchCache.get(query.toLowerCase())
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result
  }
  return null
}

export function setCachedSearch(query: string, result: any) {
  searchCache.set(query.toLowerCase(), {
    result,
    timestamp: Date.now()
  })

  // Clean old entries
  if (searchCache.size > 1000) {
    const entries = Array.from(searchCache.entries())
    entries
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 500)
      .forEach(([key]) => searchCache.delete(key))
  }
}