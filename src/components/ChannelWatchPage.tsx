import { useEffect, useState } from 'react'
import type { Channel } from '../data/channels'
import { useI18n } from '../i18n/I18nContext'
import {
  CHANNEL_PAGE_VIDEOS,
  fetchLatestVideos,
  type LiveVideo,
  type YoutubeChannelResult,
} from '../lib/youtube'

type ChannelWatchPageProps = {
  listed?: Channel
  guest?: YoutubeChannelResult | null
  youtubeChannelId: string
  youtubeUrl: string
  name: string
  handle?: string
  blurb?: string
  avatar?: string
  onBack: () => void
}

export function ChannelWatchPage({
  listed,
  guest,
  youtubeChannelId,
  youtubeUrl,
  name,
  handle,
  blurb,
  avatar,
  onBack,
}: ChannelWatchPageProps) {
  const { t } = useI18n()
  const [videos, setVideos] = useState<LiveVideo[]>(
    listed?.sampleVideos.map((video) => ({
      id: video.id,
      title: video.title,
      thumbnail: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${video.id}`,
    })) ?? [],
  )
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState<LiveVideo | null>(videos[0] ?? null)
  const [avatarFailed, setAvatarFailed] = useState(!avatar)
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchLatestVideos(youtubeChannelId, CHANNEL_PAGE_VIDEOS)
      .then((list) => {
        if (cancelled) return
        if (list.length) {
          setVideos(list)
          setPlaying((current) =>
            current && list.some((video) => video.id === current.id)
              ? current
              : list[0],
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [youtubeChannelId])

  return (
    <section className="channel-watch">
      <button type="button" className="channel-watch__back" onClick={onBack}>
        ← {t('backToChannels')}
      </button>

      <div className="channel-watch__identity">
        {avatar && !avatarFailed ? (
          <img
            className="channel-watch__avatar"
            src={avatar}
            alt=""
            onError={() => setAvatarFailed(true)}
          />
        ) : (
          <div className="channel-watch__avatar channel-watch__avatar--fallback" aria-hidden="true">
            {initials}
          </div>
        )}
        <div>
          <h2>{name}</h2>
          <p>
            {handle ? `${handle} · ` : ''}
            {listed
              ? `${listed.language} · ${listed.focus}`
              : t('notOnNirpeksh')}
          </p>
          {blurb ? <p className="channel-watch__blurb">{blurb}</p> : null}
          {guest?.description && !blurb ? (
            <p className="channel-watch__blurb">{guest.description}</p>
          ) : null}
        </div>
      </div>

      <div className="channel-watch__player">
        {playing ? (
          <iframe
            title={playing.title}
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(playing.id)}?autoplay=1&rel=0`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <p className="channel-watch__empty">
            {loading ? t('watchLoading') : t('watchEmpty')}
          </p>
        )}
      </div>

      {playing ? (
        <h3 className="channel-watch__now">{playing.title}</h3>
      ) : null}

      <h4 className="channel-watch__list-title">{t('latestVideos')}</h4>
      <div className="channel-watch__grid">
        {loading && videos.length === 0
          ? Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="video-chip" aria-hidden="true">
                <div className="video-chip--skeleton" />
                <span>Loading…</span>
              </div>
            ))
          : videos.map((video) => (
              <button
                key={video.id}
                type="button"
                className={`video-chip${playing?.id === video.id ? ' is-playing' : ''}`}
                onClick={() => setPlaying(video)}
              >
                <img src={video.thumbnail} alt="" loading="lazy" />
                <span>{video.title}</span>
              </button>
            ))}
      </div>

      <p className="channel-watch__yt">
        <a href={youtubeUrl} target="_blank" rel="noopener noreferrer">
          {t('openOnYoutube')} →
        </a>
      </p>
    </section>
  )
}
