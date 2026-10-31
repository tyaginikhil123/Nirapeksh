import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useI18n } from '../i18n/I18nContext'
import './YoutubeClonePage.css'
import {
  fetchPopularYoutubeVideos,
  fetchRelatedYoutubeVideos,
  fetchYoutubeVideo,
  formatPublishedAt,
  formatViewCount,
  hasYoutubeApiKey,
  readGuestVideo,
  rememberGuestVideo,
  searchYoutubeSuggestions,
  searchYoutubeVideos,
  type YoutubeSearchResult,
} from '../lib/youtube'

type YoutubeClonePageProps = {
  videoId: string | null
  initialQuery: string
  onSearch: (query: string) => void
  onPlay: (video: YoutubeSearchResult) => void
  onBack: () => void
}

export function YoutubeClonePage({
  videoId,
  initialQuery,
  onSearch,
  onPlay,
  onBack,
}: YoutubeClonePageProps) {
  const { t, lang } = useI18n()
  const [query, setQuery] = useState(initialQuery)
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery.trim())
  const [results, setResults] = useState<YoutubeSearchResult[]>([])
  const [related, setRelated] = useState<YoutubeSearchResult[]>([])
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [playing, setPlaying] = useState<YoutubeSearchResult | null>(() =>
    videoId ? readGuestVideo(videoId) : null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [activeSuggest, setActiveSuggest] = useState(-1)
  const configured = hasYoutubeApiKey()
  const relatedKey = playing
    ? `${playing.id}:${playing.channelId ?? ''}:${playing.title}`
    : ''

  useEffect(() => {
    setQuery(initialQuery)
    setSubmittedQuery(initialQuery.trim())
  }, [initialQuery])

  useEffect(() => {
    if (!videoId) {
      setPlaying(null)
      setRelated([])
      return
    }
    const cached = readGuestVideo(videoId)
    if (cached) setPlaying(cached)
    let cancelled = false
    fetchYoutubeVideo(videoId).then((video) => {
      if (!cancelled && video) setPlaying(video)
    })
    return () => {
      cancelled = true
    }
  }, [videoId])

  useEffect(() => {
    if (!configured || videoId) return
    let cancelled = false
    setLoading(true)
    setError('')
    const request = submittedQuery
      ? searchYoutubeVideos(submittedQuery, 24, { relevanceLanguage: null })
      : fetchPopularYoutubeVideos(24)
    request
      .then((videos) => {
        if (!cancelled) setResults(videos)
      })
      .catch((err) => {
        if (!cancelled) {
          setResults([])
          setError(err instanceof Error ? err.message : t('ytSearchEmpty'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [configured, submittedQuery, videoId, t])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 1) {
      setSuggestions([])
      setActiveSuggest(-1)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      searchYoutubeSuggestions(q)
        .then((list) => {
          if (!cancelled) {
            setSuggestions(list)
            setActiveSuggest(-1)
          }
        })
        .catch(() => {
          if (!cancelled) setSuggestions([])
        })
    }, 160)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    if (!playing || !relatedKey) {
      setRelated([])
      setRelatedLoading(false)
      return
    }
    const current = playing
    let cancelled = false
    setRelatedLoading(true)
    fetchRelatedYoutubeVideos(current, 16)
      .then((videos) => {
        if (!cancelled) setRelated(videos)
      })
      .catch(() => {
        if (!cancelled) setRelated([])
      })
      .finally(() => {
        if (!cancelled) setRelatedLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [relatedKey])

  function runSearch(nextQuery: string) {
    const next = nextQuery.trim()
    setQuery(next)
    setSubmittedQuery(next)
    setSuggestOpen(false)
    setSuggestions([])
    onSearch(next)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (suggestOpen && activeSuggest >= 0 && suggestions[activeSuggest]) {
      runSearch(suggestions[activeSuggest])
      return
    }
    runSearch(query)
  }

  function handleSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (!suggestOpen || suggestions.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveSuggest((current) => (current + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveSuggest((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1,
      )
    } else if (event.key === 'Escape') {
      setSuggestOpen(false)
    }
  }

  function playVideo(video: YoutubeSearchResult) {
    rememberGuestVideo(video)
    setPlaying(video)
    onPlay(video)
  }

  return (
    <section className="yt-home">
      <form className="yt-home__search" onSubmit={handleSubmit} autoComplete="off">
        <label className="visually-hidden" htmlFor="yt-clone-search">
          {t('youtubeSearch')}
        </label>
        <div className="yt-home__search-box">
          <input
            id="yt-clone-search"
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSuggestOpen(true)
            }}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => window.setTimeout(() => setSuggestOpen(false), 140)}
            onKeyDown={handleSearchKey}
            placeholder={t('youtubeSearchPlaceholder')}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={suggestOpen && suggestions.length > 0}
          />
          {suggestOpen && suggestions.length > 0 ? (
            <ul
              id="yt-suggest-panel"
              role="listbox"
              style={{
                background: '#fff',
                color: '#0f0f0f',
                borderRadius: '0 0 12px 12px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
              }}
            >
              {suggestions.map((item, index) => (
                <li key={item}>
                  <div
                    role="option"
                    aria-selected={index === activeSuggest}
                    className={`yt-suggest-row${index === activeSuggest ? ' is-active' : ''}`}
                    style={{
                      background: index === activeSuggest ? '#f2f2f2' : '#fff',
                      color: '#0f0f0f',
                      borderRadius: 0,
                      fontWeight: 400,
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      runSearch(item)
                    }}
                  >
                    {item}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button type="submit" className="yt-home__search-go">
          {t('youtubeSearch')}
        </button>
      </form>

      {!configured ? (
        <p className="yt-home__status">{t('youtubeNoKey')}</p>
      ) : null}

      {videoId ? (
        <div className="yt-home__watch">
          <div className="yt-home__stage">
            <button type="button" className="yt-home__back" onClick={onBack}>
              ← {t('backToYoutube')}
            </button>
            <div className="yt-home__player">
              {playing ? (
                <iframe
                  title={playing.title}
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(playing.id)}?autoplay=1&rel=0`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <p className="channel-watch__empty">{t('watchLoading')}</p>
              )}
            </div>
            {playing ? (
              <>
                <h2 className="yt-home__title">{playing.title}</h2>
                <p className="yt-home__channel">{playing.channelTitle}</p>
                {videoMetaLine(playing, lang, t('viewsLabel')) ? (
                  <p className="yt-home__meta">
                    {videoMetaLine(playing, lang, t('viewsLabel'))}
                  </p>
                ) : null}
                <a
                  className="yt-home__external"
                  href={playing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('openOnYoutube')} →
                </a>
              </>
            ) : null}
          </div>
          <aside className="yt-home__related">
            <h3>{t('youtubeRelated')}</h3>
            {relatedLoading && related.length === 0 ? (
              <p className="yt-home__status">{t('ytSearchLoading')}</p>
            ) : null}
            <div className="yt-home__related-list">
              {related.map((video) => (
                <VideoRow
                  key={video.id}
                  video={video}
                  onPlay={() => playVideo(video)}
                />
              ))}
            </div>
          </aside>
        </div>
      ) : (
        <>
          <div className="yt-home__heading">
            <h2>{submittedQuery ? t('youtubeResults') : t('youtubeTrending')}</h2>
            {submittedQuery ? <p>{submittedQuery}</p> : null}
          </div>
          {loading ? <p className="yt-home__status">{t('ytSearchLoading')}</p> : null}
          {error ? <p className="banner-note banner-note--error">{error}</p> : null}
          {!loading && configured && results.length === 0 ? (
            <p className="yt-home__status">{t('ytSearchEmpty')}</p>
          ) : null}
          <div className="yt-home__grid">
            {results.map((video) => (
              <button
                key={video.id}
                type="button"
                className="yt-home__card"
                onClick={() => playVideo(video)}
              >
                <span className="yt-home__thumb">
                  <img src={video.thumbnail} alt="" loading="lazy" />
                  {video.duration ? (
                    <span className="yt-home__duration">{video.duration}</span>
                  ) : null}
                </span>
                <span className="yt-home__card-title">{video.title}</span>
                <span className="yt-home__card-channel">{video.channelTitle}</span>
                {videoMetaLine(video, lang, t('viewsLabel')) ? (
                  <span className="yt-home__card-meta">
                    {videoMetaLine(video, lang, t('viewsLabel'))}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function videoMetaLine(
  video: YoutubeSearchResult,
  lang: 'en' | 'hi',
  viewsLabel: string,
): string {
  const parts: string[] = []
  if (typeof video.viewCount === 'number' && Number.isFinite(video.viewCount)) {
    parts.push(`${formatViewCount(video.viewCount)} ${viewsLabel}`)
  }
  if (video.publishedAt) {
    const relative = formatPublishedAt(video.publishedAt, lang)
    if (relative) parts.push(relative)
  }
  return parts.join(' · ')
}

function VideoRow({
  video,
  onPlay,
}: {
  video: YoutubeSearchResult
  onPlay: () => void
}) {
  const { t, lang } = useI18n()
  const meta = videoMetaLine(video, lang, t('viewsLabel'))
  return (
    <button type="button" className="yt-home__row" onClick={onPlay}>
      <span className="yt-home__thumb">
        <img src={video.thumbnail} alt="" loading="lazy" />
        {video.duration ? (
          <span className="yt-home__duration">{video.duration}</span>
        ) : null}
      </span>
      <span className="yt-home__row-text">
        <strong>{video.title}</strong>
        <em>{video.channelTitle}</em>
        {meta ? <em>{meta}</em> : null}
      </span>
    </button>
  )
}
