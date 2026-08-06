import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { Channel } from '../data/channels'
import { useI18n } from '../i18n/I18nContext'
import {
  fetchChannelMeta,
  getAverage,
  type SampleVideo as LiveVideo,
  type RatingState,
} from '../lib/ratings'
import { StarRating } from './StarRating'
import { TrustReviewBlock } from './TrustReviewBlock'

type ChannelCardProps = {
  channel: Channel
  rating: RatingState
  index: number
  onRate: (channelId: string, rating: number) => void
  ratingBusy?: boolean
  canRate?: boolean
  onRequestLogin?: () => void
  bookmarked?: boolean
  onToggleBookmark?: (channelId: string) => void
}

function toLiveVideo(video: { id: string; title: string }): LiveVideo {
  return {
    id: video.id,
    title: video.title,
    thumbnail: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${video.id}`,
  }
}

export function ChannelCard({
  channel,
  rating,
  index,
  onRate,
  ratingBusy = false,
  canRate = false,
  onRequestLogin,
  bookmarked = false,
  onToggleBookmark,
}: ChannelCardProps) {
  const { t } = useI18n()
  const average = getAverage(rating)
  const fallbackAvatar = `https://unavatar.io/youtube/${channel.handle.replace(/^@/, '')}`
  const [avatar, setAvatar] = useState(fallbackAvatar)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [liveVideos, setLiveVideos] = useState<LiveVideo[] | null>(null)
  const [videosLoading, setVideosLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setVideosLoading(true)
    fetchChannelMeta(channel.channelId, channel.handle)
      .then((data) => {
        if (cancelled) return
        if (data.avatar) setAvatar(data.avatar)
        setLiveVideos(data.videos)
      })
      .catch(() => {
        if (!cancelled) setLiveVideos([])
      })
      .finally(() => {
        if (!cancelled) setVideosLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [channel.channelId, channel.handle])

  const videos = useMemo(() => {
    if (videosLoading) return []
    if (liveVideos?.length) return liveVideos.slice(0, 4)
    return channel.sampleVideos.map(toLiveVideo).slice(0, 4)
  }, [videosLoading, liveVideos, channel.sampleVideos])

  const initials = channel.name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <motion.article
      className="channel"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{
        duration: 0.4,
        delay: Math.min(index * 0.03, 0.2),
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="channel__main">
        <div className="channel__top">
          <a
            className="channel__avatar-link"
            href={channel.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${channel.name} on YouTube`}
          >
            {!avatarFailed ? (
              <img
                className="channel__avatar-img"
                src={avatar}
                alt=""
                loading="lazy"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <div className="channel__avatar" aria-hidden="true">
                {initials}
              </div>
            )}
          </a>

          <div className="channel__identity">
            <div className="channel__title-row">
              <h3>
                <a
                  href={channel.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {channel.name}
                </a>
              </h3>
              <span className="channel__subs">{channel.subscribersLabel}</span>
              <button
                type="button"
                className={`bookmark-btn${bookmarked ? ' is-on' : ''}`}
                onClick={() => onToggleBookmark?.(channel.id)}
                aria-pressed={bookmarked}
              >
                {bookmarked ? t('bookmarked') : t('bookmark')}
              </button>
            </div>
            <p>
              {channel.handle} · {channel.founder}
            </p>
            <div className="channel__tags">
              <span>{channel.language}</span>
              <span>{channel.focus}</span>
              {channel.tags.slice(0, 4).map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
        </div>

        <p className="channel__blurb">{channel.blurb}</p>

        <div className="channel__videos" aria-label={`Latest videos from ${channel.name}`}>
          {videosLoading ? (
            Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="video-chip" aria-hidden="true">
                <div className="video-chip--skeleton" />
                <span>Loading…</span>
              </div>
            ))
          ) : videos.length > 0 ? (
            videos.map((video) => (
              <a
                key={video.id + video.title}
                className="video-chip"
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img src={video.thumbnail} alt="" loading="lazy" />
                <span>{video.title}</span>
              </a>
            ))
          ) : (
            <a
              className="video-chip video-chip--empty"
              href={channel.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Open channel to browse recent videos on YouTube →</span>
            </a>
          )}
        </div>
      </div>

      <div className="channel__footer channel__footer--split">
        <StarRating
          value={average}
          userRating={rating.userRating}
          voteCount={rating.count}
          onRate={(value) => onRate(channel.id, value)}
          disabled={ratingBusy}
          locked={!canRate}
          onUnlock={onRequestLogin}
        />
        <TrustReviewBlock
          channelId={channel.id}
          canWrite={Boolean(canRate)}
          onRequestLogin={onRequestLogin}
        />
        <a
          className="channel__cta"
          href={channel.youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('openChannel')}
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </motion.article>
  )
}
