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
import { ChannelWatchPage } from './components/ChannelWatchPage'
import { DirectoryFilters } from './components/DirectoryFilters'
import { FeedbackForm } from './components/FeedbackForm'
import { PaletteChooser } from './components/PaletteChooser'
import { ReportPage } from './components/ReportPage'
import { VideoPlayerModal } from './components/VideoPlayerModal'
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
  EMPTY_AXES,
  fetchAllRatings,
  getAverage,
  loadChannelsOrSeed,
  submitAuthenticatedRating,
  type AxisScores,
  type RatingState,
} from './lib/ratings'
import {
  navigate,
  navigateChannel,
  parseChannelRoute,
  pathToView,
  readHomeFilters,
  type AppView,
  type ChannelRoute,
} from './lib/routing'
import { smartSearchChannels, type SearchVideoIndex } from './lib/smartSearch'
import {
  fetchLatestVideos,
  readGuestChannel,
  rememberGuestChannel,
  searchYoutubeChannels,
  searchYoutubeVideos,
  type YoutubeChannelResult,
  type YoutubeSearchResult,
} from './lib/youtube'
import { useTheme } from './theme/ThemeContext'

const MAKER_EMAIL = 'kumarnikhil474551@gmail.com'
const ADMIN_EMAIL = (
  import.meta.env.VITE_ADMIN_EMAIL as string | undefined
)?.toLowerCase() || MAKER_EMAIL.toLowerCase()

function emptyRatings(list: Channel[]): Record<string, RatingState> {
  return Object.fromEntries(
    list.map((channel) => [
      channel.id,
      {
        sum: 0,
        count: 0,
        average: 0,
        userRating: null,
        axes: { ...EMPTY_AXES },
        userAxes: null,
      },
    ]),
  )
}

const initialFilters = readHomeFilters()

function ChannelWatchBlock({
  route,
  channels,
  onBack,
}: {
  route: ChannelRoute | null
  channels: Channel[]
  onBack: () => void
}) {
  const { t } = useI18n()
  const listed =
    (route?.listedId
      ? channels.find((channel) => channel.id === route.listedId)
      : undefined) ??
    (route?.youtubeId
      ? channels.find((channel) => channel.channelId === route.youtubeId)
      : undefined)
  const guest =
    !listed && route?.youtubeId ? readGuestChannel(route.youtubeId) : null
  const youtubeChannelId = listed?.channelId ?? route?.youtubeId

  if (!youtubeChannelId) {
    return (
      <section className="channel-watch">
        <button type="button" className="channel-watch__back" onClick={onBack}>
          ← {t('backToChannels')}
        </button>
        <p>{t('watchEmpty')}</p>
      </section>
    )
  }

  return (
    <ChannelWatchPage
      listed={listed}
      guest={guest}
      youtubeChannelId={youtubeChannelId}
      youtubeUrl={
        listed?.youtubeUrl ??
        guest?.url ??
        `https://www.youtube.com/channel/${youtubeChannelId}`
      }
      name={listed?.name ?? guest?.title ?? 'YouTube'}
      handle={listed?.handle}
      blurb={listed?.blurb}
      avatar={
        listed
          ? `https://unavatar.io/youtube/${listed.handle.replace(/^@/, '')}`
          : guest?.thumbnail
      }
      onBack={onBack}
    />
  )
}

export default function App() {
  const { user, configured, loading: authLoading, signIn } = useAuth()
  const { t, lang, setLang } = useI18n()
  const { theme, toggleTheme } = useTheme()

  const [view, setViewState] = useState<AppView>(() =>
    pathToView(window.location.pathname),
  )
  const [channelRoute, setChannelRoute] = useState<ChannelRoute | null>(() =>
    parseChannelRoute(window.location.pathname),
  )
  const [channelList, setChannelList] = useState<Channel[]>(seedChannels)
  const [query, setQuery] = useState(initialFilters.query)
  const [language, setLanguage] = useState<Language | 'All'>(initialFilters.language)
  const [focus, setFocus] = useState<Focus | 'All'>(initialFilters.focus)
  const [tag, setTag] = useState<string | 'All'>(initialFilters.tag)
  const [sort, setSort] = useState<'rating' | 'name'>(initialFilters.sort)
  const [bookmarksOnly, setBookmarksOnly] = useState(initialFilters.bookmarksOnly)
  const [bookmarks, setBookmarks] = useState<string[]>(() => readBookmarks())
  const [ratings, setRatings] = useState(() => emptyRatings(seedChannels))
  const [ratingBusyId, setRatingBusyId] = useState<string | null>(null)
  const [ratingError, setRatingError] = useState('')
  const [ytResults, setYtResults] = useState<YoutubeSearchResult[]>([])
  const [ytChannels, setYtChannels] = useState<YoutubeChannelResult[]>([])
  const [ytLoading, setYtLoading] = useState(false)
  const [ytError, setYtError] = useState('')
  const [playingYt, setPlayingYt] = useState<YoutubeSearchResult | null>(null)
  const [videoIndex, setVideoIndex] = useState<SearchVideoIndex>({})
  const [, startTransition] = useTransition()
  const deferredQuery = useDeferredValue(query)

  const homeFilters = useMemo(
    () => ({ query, language, focus, tag, sort, bookmarksOnly }),
    [query, language, focus, tag, sort, bookmarksOnly],
  )

  function setView(next: AppView, replace = false) {
    setViewState(next)
    navigate(next, next === 'home' ? homeFilters : undefined, replace)
  }

  useEffect(() => {
    function onPopState() {
      const nextView = pathToView(window.location.pathname)
      setViewState(nextView)
      setChannelRoute(parseChannelRoute(window.location.pathname))
      if (nextView === 'home') {
        const filters = readHomeFilters()
        startTransition(() => {
          setQuery(filters.query)
          setLanguage(filters.language)
          setFocus(filters.focus)
          setTag(filters.tag)
          setSort(filters.sort)
          setBookmarksOnly(filters.bookmarksOnly)
        })
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (view !== 'home') return
    navigate('home', homeFilters, true)
  }, [view, homeFilters])

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

  // Prefetch latest video titles so search can match words like "Jharkhand" on cards.
  useEffect(() => {
    let cancelled = false

    async function indexVideos() {
      const entries = await Promise.all(
        channelList.map(async (channel) => {
          try {
            const videos = await fetchLatestVideos(channel.channelId)
            return [channel.id, videos.map((video) => video.title)] as const
          } catch {
            return [channel.id, [] as string[]] as const
          }
        }),
      )
      if (!cancelled) {
        setVideoIndex(Object.fromEntries(entries))
      }
    }

    void indexVideos()
    return () => {
      cancelled = true
    }
  }, [channelList])

  const tagOptions = useMemo(() => allTags(channelList), [channelList])

  const filtered = useMemo(() => {
    const base = channelList.filter((channel) => {
      const matchesLanguage = language === 'All' || channel.language === language
      const matchesFocus = focus === 'All' || channel.focus === focus
      const matchesTag = tag === 'All' || channel.tags.includes(tag)
      const matchesBookmark = !bookmarksOnly || bookmarks.includes(channel.id)
      return matchesLanguage && matchesFocus && matchesTag && matchesBookmark
    })

    const scored = smartSearchChannels(base, deferredQuery, videoIndex)
    const list = scored.map((row) => row.channel)
    const scoreMap = new Map(scored.map((row) => [row.channel.id, row.score]))
    const hasQuery = Boolean(deferredQuery.trim())

    return list.sort((a, b) => {
      if (hasQuery) {
        const scoreDiff = (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0)
        if (scoreDiff !== 0) return scoreDiff
      }
      if (sort === 'name') return a.name.localeCompare(b.name)
      const diff =
        getAverage(ratings[b.id] ?? { average: 0, sum: 0, count: 0, userRating: null }) -
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
    videoIndex,
  ])

  useEffect(() => {
    const q = deferredQuery.trim()
    if (filtered.length > 0 || !q || view !== 'home') {
      setYtResults([])
      setYtChannels([])
      setYtError('')
      setYtLoading(false)
      return
    }

    let cancelled = false
    setYtLoading(true)
    setYtError('')
    const listedIds = new Set(channelList.map((channel) => channel.channelId))
    const timer = window.setTimeout(() => {
      Promise.all([searchYoutubeChannels(q), searchYoutubeVideos(q)])
        .then(([channels, videos]) => {
          if (cancelled) return
          setYtChannels(channels.filter((channel) => !listedIds.has(channel.id)))
          setYtResults(videos)
        })
        .catch((err) => {
          if (!cancelled) {
            setYtChannels([])
            setYtResults([])
            setYtError(err instanceof Error ? err.message : 'YouTube search failed')
          }
        })
        .finally(() => {
          if (!cancelled) setYtLoading(false)
        })
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [deferredQuery, filtered.length, view, channelList])

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
    setRatingError('')
    try {
      await signIn()
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String(err.code)
          : ''
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request'
      ) {
        return
      }
      setRatingError(
        err instanceof Error ? err.message : 'Sign-in failed. Try the header button.',
      )
    }
  }

  async function handleRate(channelId: string, value: number | AxisScores) {
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

  function openListedChannel(channelId: string) {
    const route = { listedId: channelId }
    setChannelRoute(route)
    setViewState('channel')
    navigateChannel(route)
    window.scrollTo({ top: 0 })
  }

  function openGuestChannel(channel: YoutubeChannelResult) {
    rememberGuestChannel(channel)
    const listed = channelList.find((item) => item.channelId === channel.id)
    const route: ChannelRoute = listed
      ? { listedId: listed.id }
      : { youtubeId: channel.id }
    setChannelRoute(route)
    setViewState('channel')
    navigateChannel(route)
    window.scrollTo({ top: 0 })
  }

  function openChannelFromInsight(channelId: string) {
    const channel = channelList.find((item) => item.id === channelId)
    startTransition(() => {
      setQuery(channel?.name ?? '')
      setLanguage('All')
      setFocus('All')
      setTag('All')
      setBookmarksOnly(false)
    })
    setView('home')
    window.setTimeout(() => {
      document.getElementById(`channel-${channelId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 120)
  }

  const isAdminUser = Boolean(
    user?.email && user.email.toLowerCase() === ADMIN_EMAIL,
  )

  useEffect(() => {
    if (view === 'admin' && !isAdminUser) {
      setView('home', true)
    }
  }, [view, isAdminUser])

  return (
    <div className="page">
      <header className="site-header">
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault()
            setView('home')
          }}
        >
          <span className="brand__mark" aria-hidden="true" />
          Nirpeksh
        </a>
        <nav className="site-nav">
          <button
            type="button"
            className={`nav-link${view === 'home' ? ' is-active' : ''}`}
            onClick={() => setView('home')}
          >
            {t('channels')}
          </button>
          <button
            type="button"
            className={`nav-link${view === 'report' ? ' is-active' : ''}`}
            onClick={() => setView('report')}
          >
            <span className="nav-link__full">{t('report')}</span>
            <span className="nav-link__short">{t('reportShort')}</span>
          </button>
          <button
            type="button"
            className={`nav-link${view === 'about' ? ' is-active' : ''}`}
            onClick={() => setView('about')}
          >
            {t('about')}
          </button>
          <button
            type="button"
            className={`nav-link${view === 'feedback' ? ' is-active' : ''}`}
            onClick={() => setView('feedback')}
          >
            {t('feedback')}
          </button>
          {isAdminUser ? (
            <button
              type="button"
              className={`nav-link${view === 'admin' ? ' is-active' : ''}`}
              onClick={() => setView('admin')}
            >
              {t('admin')}
            </button>
          ) : null}
        </nav>
        <div className="site-header__actions">
          <div className="toolbar">
            <PaletteChooser />
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
        {view === 'report' ? (
          <ReportPage
            channels={channelList}
            ratings={ratings}
            onBrowseChannels={() => setView('home')}
            onViewChannel={openChannelFromInsight}
            onWatchChannel={openListedChannel}
          />
        ) : null}
        {view === 'feedback' ? <FeedbackForm /> : null}
        {view === 'channel' ? (
          <ChannelWatchBlock
            route={channelRoute}
            channels={channelList}
            onBack={() => setView('home')}
          />
        ) : null}
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
            <section className="hero">
              <div className="hero__glow" aria-hidden="true" />
              <div className="hero__content">
                <h1 className="hero__brand">
                  Nirpeksh
                  <span className="hero__brand-hi">निरपेक्ष</span>
                </h1>
                <p className="hero__page-line">{t('pageContains')}</p>
                <p className="hero__title">{t('heroTitle')}</p>
                <p className="hero__lede">{t('heroLede')}</p>
                <p className="hero__lede hero__lede--second">{t('heroLede2')}</p>
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
                    allChannels={channelList}
                    rating={
                      ratings[channel.id] ?? {
                        sum: 0,
                        count: 0,
                        average: 0,
                        userRating: null,
                        axes: { ...EMPTY_AXES },
                        userAxes: null,
                      }
                    }
                    index={index}
                    onRate={handleRate}
                    ratingBusy={ratingBusyId === channel.id}
                    canRate={Boolean(user)}
                    onRequestLogin={() => void handleRequestLogin()}
                    bookmarked={bookmarks.includes(channel.id)}
                    onToggleBookmark={handleToggleBookmark}
                    onOpenChannel={openListedChannel}
                  />
                ))}
              </div>

              {filtered.length === 0 && (
                <div className="directory__empty-block">
                  <p className="directory__empty">
                    {t('noResults')}{' '}
                    <button type="button" className="text-btn" onClick={refreshFilters}>
                      {t('refresh')}
                    </button>
                  </p>

                  {deferredQuery.trim() ? (
                    <section className="yt-search" aria-live="polite">
                      <h3 className="yt-search__title">{t('ytSearchTitle')}</h3>
                      <p className="yt-search__lede">{t('ytSearchLede')}</p>
                      {ytLoading ? <p className="yt-search__status">{t('ytSearchLoading')}</p> : null}
                      {ytError ? (
                        <p className="banner-note banner-note--error">{ytError}</p>
                      ) : null}
                      {!ytLoading &&
                      !ytError &&
                      ytChannels.length === 0 &&
                      ytResults.length === 0 ? (
                        <p className="yt-search__status">{t('ytSearchEmpty')}</p>
                      ) : null}

                      {ytChannels.length > 0 ? (
                        <>
                          <h4 className="yt-search__subtitle">{t('ytChannelTitle')}</h4>
                          <div className="yt-search__channels">
                            {ytChannels.map((channel) => (
                              <button
                                key={channel.id}
                                type="button"
                                className="yt-channel-card"
                                onClick={() => openGuestChannel(channel)}
                              >
                                {channel.thumbnail ? (
                                  <img
                                    className="yt-channel-card__avatar"
                                    src={channel.thumbnail}
                                    alt=""
                                    loading="lazy"
                                  />
                                ) : (
                                  <div
                                    className="yt-channel-card__avatar yt-channel-card__avatar--fallback"
                                    aria-hidden="true"
                                  >
                                    {channel.title.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div className="yt-channel-card__body">
                                  <strong className="yt-channel-card__name">{channel.title}</strong>
                                  <span className="yt-channel-card__badge">{t('notOnNirpeksh')}</span>
                                  {channel.description ? (
                                    <p className="yt-channel-card__desc">{channel.description}</p>
                                  ) : null}
                                  <span className="yt-channel-card__cta">
                                    {t('openChannel')}
                                    <span aria-hidden="true"> →</span>
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      ) : null}

                      {ytResults.length > 0 ? (
                        <>
                          <h4 className="yt-search__subtitle">{t('ytVideosTitle')}</h4>
                          <div className="yt-search__grid">
                            {ytResults.map((video) => (
                              <button
                                key={video.id}
                                type="button"
                                className="yt-search__card"
                                onClick={() => setPlayingYt(video)}
                              >
                                <img src={video.thumbnail} alt="" loading="lazy" />
                                <span className="yt-search__video-title">{video.title}</span>
                                <span className="yt-search__channel">{video.channelTitle}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </section>
                  ) : null}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>

      <footer className="site-footer">
        <div>
          <strong>Nirpeksh</strong>
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
              Builder of Nirpeksh · Independent media directory
            </p>
            <a href={`mailto:${MAKER_EMAIL}`}>{MAKER_EMAIL}</a>
          </div>
        </div>
      </footer>

      {playingYt ? (
        <VideoPlayerModal
          videoId={playingYt.id}
          title={playingYt.title}
          onClose={() => setPlayingYt(null)}
        />
      ) : null}
    </div>
  )
}
