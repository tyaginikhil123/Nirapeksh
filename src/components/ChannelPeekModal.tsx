import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Channel } from '../data/channels'
import { useI18n } from '../i18n/I18nContext'
import { NirpekshMeter } from './NirpekshMeter'

export type ChannelPeek = {
  channel: Channel
  rank: number
  average: number
  count: number
}

type ChannelPeekModalProps = {
  peek: ChannelPeek
  onClose: () => void
  onViewChannel: (channelId: string) => void
  onWatchChannel: (channelId: string) => void
}

export function ChannelPeekModal({
  peek,
  onClose,
  onViewChannel,
  onWatchChannel,
}: ChannelPeekModalProps) {
  const { t } = useI18n()
  const { channel, rank, average, count } = peek
  const rated = count > 0
  const fallbackAvatar = `https://unavatar.io/youtube/${channel.handle.replace(/^@/, '')}`
  const [avatarFailed, setAvatarFailed] = useState(false)
  const initials = channel.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div
      className="video-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="channel-peek-title"
      onClick={onClose}
    >
      <div
        className="channel-peek"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="channel-peek__head">
          <p className="channel-peek__rank">#{rank}</p>
          <button
            type="button"
            className="video-modal__close"
            onClick={onClose}
            aria-label={t('closePeek')}
          >
            ×
          </button>
        </div>

        <div className="channel-peek__identity">
          {!avatarFailed ? (
            <img
              className="channel-peek__avatar"
              src={fallbackAvatar}
              alt=""
              onError={() => setAvatarFailed(true)}
            />
          ) : (
            <div className="channel-peek__avatar channel-peek__avatar--fallback" aria-hidden="true">
              {initials}
            </div>
          )}
          <div>
            <h2 id="channel-peek-title">{channel.name}</h2>
            <p>
              {channel.handle} · {channel.language} · {channel.focus}
            </p>
          </div>
        </div>

        <NirpekshMeter
          value={average}
          rated={rated}
          size="lg"
          label={t('meterTitle')}
        />

        <p className="channel-peek__votes">
          {rated
            ? `${average.toFixed(1)} / 5 · ${count.toLocaleString()} ${
                count === 1 ? t('reportVote') : t('reportVotesShort')
              }`
            : t('reportNoVotes')}
        </p>

        <p className="channel-peek__blurb">{channel.blurb}</p>

        <div className="channel-peek__actions">
          <div className="channel__cta-split">
            <button
              type="button"
              className="channel__cta channel__cta--app"
              onClick={() => onWatchChannel(channel.id)}
            >
              {t('openChannel')}
            </button>
            <a
              className="channel__cta"
              href={channel.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('openOnYoutube')}
            </a>
          </div>
          <button
            type="button"
            className="channel-peek__view"
            onClick={() => onViewChannel(channel.id)}
          >
            {t('viewOnNirpeksh')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
