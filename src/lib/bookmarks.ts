const KEY = 'nirapeksh-bookmarks-v1'

export function readBookmarks(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeBookmarks(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify(ids))
}

export function toggleBookmark(channelId: string): string[] {
  const current = readBookmarks()
  const next = current.includes(channelId)
    ? current.filter((id) => id !== channelId)
    : [...current, channelId]
  writeBookmarks(next)
  return next
}
