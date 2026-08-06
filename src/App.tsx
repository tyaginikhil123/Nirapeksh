import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react'
import { useAuth } from './auth/AuthContext'
import { AboutPage } from './components/AboutPage'
import { AdminPanel } from './components/AdminPanel'
import { AuthControls } from './components/AuthControls'
import { ChannelCard } from './components/ChannelCard'
import { DirectoryFilters } from './components/DirectoryFilters'
import { FeedbackForm } from './components/FeedbackForm'
import {
  allTags,
  channels as seedChannels,
  type Channel,
  type Focus,
  type Language,
} from './data/channels'
import { useI18n } from './i18n/I18nContext'
import { readBookmarks, toggleBookmark } from './lib/bookmarks'
import {
  fetchAllRatings,
  getAverage,
  loadChannelsOrSeed,
  submitAuthenticatedRating,
  type RatingState,
} from './lib/ratings'
import { useTheme } from './theme/ThemeContext'

const MAKER_EMAIL = 'kumarnikhil474551@gmail.com'
const ADMIN_EMAIL = (
  import.meta.env.VITE_ADMIN_EMAIL as string | undefined
)?.toLowerCase() || MAKER_EMAIL.toLowerCase()

type View = 'home' | 'about' | 'admin' | 'feedback'

function emptyRatings(list: Channel[]): Record<string, RatingState> {
  return Object.fromEntries(
    list.map((channel) => [
      channel.id,
      { sum: 0, count: 0, average: 0, userRating: null },
    ]),
  )
}

export default function App() {
  const { user, configured, loading: authLoading } = useAuth()
  const { t, lang, setLang } = useI18n()
  const { theme, toggleTheme } = useTheme()

  const [view, setView] = useState<View>('home')
  const [channelList, setChannelList] = useState<Channel[]>(seedChannels)
  const [query, setQuery] = useState('')
  const [language, setLanguage] = useState<Language | 'All'>('All')
  const [focus, setFocus] = useState<Focus | 'All'>('All')
  const [tag, setTag] = useState<string | 'All'>('All')
  const [sort, setSort] = useState<'rating' | 'name'>('rating')
  const [bookmarksOnly, setBookmarksOnly] = useState(false)
  const [bookmarks, setBookmarks] = useState<string[]>(() => readBookmarks())
  const [ratings, setRatings] = useState(() => emptyRatings(seedChannels))
  const [ratingBusyId, setRatingBusyId] = useState<string | null>(null)
  const [ratingError, setRatingError] = useState('')
  const [, startTransition] = useTransition()
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    let cancelled = false
    loadChannelsOrSeed(seedChannels).then((list) => {
      if (!cancelled && list.length) setChannelList(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const data = await fetchAllRatings(channelList.map((channel) => channel.id))
      if (!cancelled) setRatings(data)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user, channelList])

  const tagOptions = useMemo(() => allTags(channelList), [channelList])

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()

    const list = channelList.filter((channel) => {
      const haystack = [
        channel.name,
        channel.handle,
        channel.founder,
        channel.blurb,
        channel.focus,
        ...channel.tags,
        ...channel.sampleVideos.map((video) => video.title),
      ]
        .join(' ')
        .toLowerCase()

      const matchesQuery = !q || haystack.includes(q)
      const matchesLanguage = language === 'All' || channel.language === language
      const matchesFocus = focus === 'All' || channel.focus === focus
      const matchesTag = tag === 'All' || channel.tags.includes(tag)
      const matchesBookmark = !bookmarksOnly || bookmarks.includes(channel.id)

      return (
        matchesQuery &&
        matchesLanguage &&
        matchesFocus &&
        matchesTag &&
        matchesBookmark
      )
    })

    return list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      const diff = getAverage(ratings[b.id] ?? { average: 0, sum: 0, count: 0, userRating: null }) -
        getAverage(ratings[a.id] ?? { average: 0, sum: 0, count: 0, userRating: null })
      if (diff !== 0) return diff
      return a.name.localeCompare(b.name)
    })
  }, [
    deferredQuery,
    language,
    focus,
    tag,
    sort,
    ratings,
    channelList,
    bookmarks,
    bookmarksOnly,
  ])

  function refreshFilters() {
    startTransition(() => {
      setQuery('')
      setLanguage('All')
      setFocus('All')
      setTag('All')
      setSort('rating')
      setBookmarksOnly(false)
    })
  }

  async function handleRequestLogin() {
    if (!configured) {
      setRatingError(t('loginNeeded'))
      return
    }
    setRatingError('Use Sign in with Google in the top-right header first.')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleRate(channelId: string, value: number) {
    if (!user) {
      await handleRequestLogin()
      return
    }

    setRatingBusyId(channelId)
    setRatingError('')
    try {
      const next = await submitAuthenticatedRating(channelId, value)
      setRatings((prev) => ({ ...prev, [channelId]: next }))
    } catch (err) {
      setRatingError(err instanceof Error ? err.message : 'Could not save rating')
    } finally {
      setRatingBusyId(null)
    }
  }

  function handleToggleBookmark(channelId: string) {
    setBookmarks(toggleBookmark(channelId))
  }

  const isAdminUser = Boolean(
    user?.email && user.email.toLowerCase() === ADMIN_EMAIL,
  )

  useEffect(() => {
    if (view === 'admin' && !isAdminUser) {
      setView('home')
    }
  }, [view, isAdminUser])

  return (
    <div className="page">
      <header className="site-header">
        <a
          className="brand"
          href="#top"
          onClick={() => setView('home')}
        >
          <span className="brand__mark" aria-hidden="true" />
          Nirapeksh
        </a>
        <div className="site-header__right">
          <nav className="site-nav">
            <button type="button" className="nav-link" onClick={() => setView('home')}>
              {t('channels')}
            </button>
            <button type="button" className="nav-link" onClick={() => setView('about')}>
              {t('about')}
            </button>
            <button
              type="button"
              className="nav-link"
              onClick={() => setView('feedback')}
            >
              {t('feedback')}
            </button>
            {isAdminUser ? (
              <button
                type="button"
                className="nav-link"
                onClick={() => setView('admin')}
              >
                {t('admin')}
              </button>
            ) : null}
          </nav>
          <div className="toolbar">
            <button type="button" className="auth-btn" onClick={toggleTheme}>
              {theme === 'light' ? t('themeDark') : t('themeLight')}
            </button>
            <button
              type="button"
              className={`auth-btn${lang === 'en' ? ' is-active' : ''}`}
              onClick={() => setLang('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={`auth-btn${lang === 'hi' ? ' is-active' : ''}`}
              onClick={() => setLang('hi')}
            >
              हिं
            </button>
          </div>
          <AuthControls />
        </div>
      </header>

      <main id="top">
        {view === 'about' ? <AboutPage /> : null}
        {view === 'feedback' ? <FeedbackForm /> : null}
        {view === 'admin' && isAdminUser ? (
          <AdminPanel
            channels={channelList}
            onSaved={(next) => {
              setChannelList(next)
              setView('home')
            }}
            onClose={() => setView('home')}
          />
        ) : null}

        {view === 'home' ? (
          <>
            <section className="hero hero--compact">
              <div className="hero__content">
                <p className="hero__brand">Nirapeksh</p>
                <h1>{t('heroTitle')}</h1>
                <p className="hero__lede">{t('heroLede')}</p>
              </div>
            </section>

            {!configured && !authLoading ? (
              <p className="banner-note">{t('loginNeeded')}</p>
            ) : null}
            {ratingError ? (
              <p className="banner-note banner-note--error">{ratingError}</p>
            ) : null}

            <section className="directory" id="directory">
              <div className="directory__intro">
                <h2>{t('channelList')}</h2>
                <p>{t('channelListLede')}</p>
              </div>

              <DirectoryFilters
                query={query}
                language={language}
                focus={focus}
                tag={tag}
                tags={tagOptions}
                sort={sort}
                bookmarksOnly={bookmarksOnly}
                onQueryChange={setQuery}
                onLanguageChange={setLanguage}
                onFocusChange={setFocus}
                onTagChange={setTag}
                onSortChange={setSort}
                onBookmarksOnlyChange={setBookmarksOnly}
                onRefresh={refreshFilters}
                resultCount={filtered.length}
              />

              <div className="directory__list">
                {filtered.map((channel, index) => (
                  <ChannelCard
                    key={channel.id}
                    channel={channel}
                    rating={
                      ratings[channel.id] ?? {
                        sum: 0,
                        count: 0,
                        average: 0,
                        userRating: null,
                      }
                    }
                    index={index}
                    onRate={handleRate}
                    ratingBusy={ratingBusyId === channel.id}
                    canRate={Boolean(user)}
                    onRequestLogin={() => void handleRequestLogin()}
                    bookmarked={bookmarks.includes(channel.id)}
                    onToggleBookmark={handleToggleBookmark}
                  />
                ))}
              </div>

              {filtered.length === 0 && (
                <p className="directory__empty">
                  {t('noResults')}{' '}
                  <button type="button" className="text-btn" onClick={refreshFilters}>
                    {t('refresh')}
                  </button>
                </p>
              )}
            </section>
          </>
        ) : null}
      </main>

      <footer className="site-footer">
        <div>
          <strong>Nirapeksh</strong>
          <p>
            Verified ratings need Google sign-in. Trust notes are optional.
            Bookmarks stay in your browser.
          </p>
        </div>
        <div className="site-footer__maker">
          <div className="maker-mark" aria-hidden="true">
            NT
          </div>
          <div className="maker-copy">
            <p className="maker-copy__eyebrow">{t('madeBy')}</p>
            <p className="maker-copy__name">Nikhil Tyagi</p>
            <p className="maker-copy__role">
              Builder of Nirapeksh · Independent media directory
            </p>
            <a href={`mailto:${MAKER_EMAIL}`}>{MAKER_EMAIL}</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
