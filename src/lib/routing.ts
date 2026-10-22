import type { Focus, Language } from '../data/channels'

export type AppView =
  | 'home'
  | 'youtube'
  | 'admin'
  | 'feedback'
  | 'report'
  | 'channel'

export type HomeFilters = {
  query: string
  language: Language | 'All'
  focus: Focus | 'All'
  tag: string | 'All'
  sort: 'rating' | 'name'
  bookmarksOnly: boolean
}

export type ChannelRoute = {
  listedId?: string
  youtubeId?: string
}

const VIEW_PATHS: Record<Exclude<AppView, 'home' | 'channel'>, string> = {
  youtube: '/youtube',
  admin: '/admin',
  feedback: '/feedback',
  report: '/report',
}

const LANGUAGES = new Set(['All', 'Hindi', 'English', 'Both'])
const SORTS = new Set(['rating', 'name'])

export function parseChannelRoute(pathname: string): ChannelRoute | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  const listed = path.match(/^\/channel\/([^/]+)$/)
  if (listed?.[1]) {
    return { listedId: decodeURIComponent(listed[1]) }
  }
  const watch = path.match(/^\/watch\/([^/]+)$/)
  if (watch?.[1]) {
    return { youtubeId: decodeURIComponent(watch[1]) }
  }
  return null
}

export function channelToPath(route: ChannelRoute): string {
  if (route.listedId) return `/channel/${encodeURIComponent(route.listedId)}`
  if (route.youtubeId) return `/watch/${encodeURIComponent(route.youtubeId)}`
  return '/'
}

export function parseYoutubeVideoRoute(pathname: string): { videoId: string } | null {
  const path = pathname.replace(/\/+$/, '') || '/'
  const match = path.match(/^\/youtube\/watch\/([^/]+)$/)
  if (match?.[1]) return { videoId: decodeURIComponent(match[1]) }
  return null
}

export function pathToView(pathname: string): AppView {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/about') return 'feedback'
  if (path === '/youtube' || path.startsWith('/youtube/')) return 'youtube'
  if (path === '/admin') return 'admin'
  if (path === '/feedback') return 'feedback'
  if (path === '/report') return 'report'
  if (parseChannelRoute(path)) return 'channel'
  return 'home'
}

export function viewToPath(view: AppView): string {
  if (view === 'home') return '/'
  if (view === 'channel' || view === 'youtube') return window.location.pathname
  return VIEW_PATHS[view]
}

export function readHomeFilters(search = window.location.search): HomeFilters {
  const params = new URLSearchParams(search)
  const language = params.get('language') ?? 'All'
  const focus = params.get('focus') ?? 'All'
  const sort = params.get('sort') ?? 'rating'
  const tag = params.get('tag') ?? 'All'

  return {
    query: params.get('q') ?? '',
    language: (LANGUAGES.has(language) ? language : 'All') as Language | 'All',
    focus: focus as Focus | 'All',
    tag,
    sort: (SORTS.has(sort) ? sort : 'rating') as 'rating' | 'name',
    bookmarksOnly: params.get('bookmarks') === '1',
  }
}

export function buildHomeSearch(filters: HomeFilters): string {
  const params = new URLSearchParams()
  if (filters.query.trim()) params.set('q', filters.query.trim())
  if (filters.language !== 'All') params.set('language', filters.language)
  if (filters.focus !== 'All') params.set('focus', filters.focus)
  if (filters.tag !== 'All') params.set('tag', filters.tag)
  if (filters.sort !== 'rating') params.set('sort', filters.sort)
  if (filters.bookmarksOnly) params.set('bookmarks', '1')
  const text = params.toString()
  return text ? `?${text}` : ''
}

function writeUrl(url: string, view: AppView, replace: boolean) {
  const current = `${window.location.pathname}${window.location.search}`
  if (url === current) return
  if (replace) {
    window.history.replaceState({ view }, '', url)
  } else {
    window.history.pushState({ view }, '', url)
  }
}

export function navigate(view: AppView, filters?: HomeFilters, replace = false) {
  if (view === 'channel') return
  if (view === 'youtube') {
    writeUrl('/youtube', view, replace)
    return
  }
  const path = viewToPath(view)
  const search = view === 'home' && filters ? buildHomeSearch(filters) : ''
  writeUrl(`${path}${search}`, view, replace)
}

export function navigateYoutubeSearch(query: string, replace = false) {
  const q = query.trim()
  const url = q ? `/youtube?q=${encodeURIComponent(q)}` : '/youtube'
  writeUrl(url, 'youtube', replace)
}

export function navigateYoutubeWatch(videoId: string, replace = false) {
  writeUrl(`/youtube/watch/${encodeURIComponent(videoId)}`, 'youtube', replace)
}

export function navigateChannel(route: ChannelRoute, replace = false) {
  writeUrl(channelToPath(route), 'channel', replace)
}
