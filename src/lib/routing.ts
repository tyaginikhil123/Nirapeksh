import type { Focus, Language } from '../data/channels'

export type AppView = 'home' | 'about' | 'admin' | 'feedback' | 'report'

export type HomeFilters = {
  query: string
  language: Language | 'All'
  focus: Focus | 'All'
  tag: string | 'All'
  sort: 'rating' | 'name'
  bookmarksOnly: boolean
}

const VIEW_PATHS: Record<Exclude<AppView, 'home'>, string> = {
  about: '/about',
  admin: '/admin',
  feedback: '/feedback',
  report: '/report',
}

const LANGUAGES = new Set(['All', 'Hindi', 'English', 'Both'])
const SORTS = new Set(['rating', 'name'])

export function pathToView(pathname: string): AppView {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/about') return 'about'
  if (path === '/admin') return 'admin'
  if (path === '/feedback') return 'feedback'
  if (path === '/report') return 'report'
  return 'home'
}

export function viewToPath(view: AppView): string {
  if (view === 'home') return '/'
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

export function navigate(view: AppView, filters?: HomeFilters, replace = false) {
  const path = viewToPath(view)
  const search = view === 'home' && filters ? buildHomeSearch(filters) : ''
  const url = `${path}${search}`
  const current = `${window.location.pathname}${window.location.search}`
  if (url === current) return
  if (replace) {
    window.history.replaceState({ view }, '', url)
  } else {
    window.history.pushState({ view }, '', url)
  }
}
