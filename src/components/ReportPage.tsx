import { useEffect, useState } from 'react'
import type { Channel } from '../data/channels'
import { useI18n } from '../i18n/I18nContext'
import { getAverage, type RatingState } from '../lib/ratings'
import {
  fetchAllChannelReviews,
  type ChannelReview,
} from '../lib/reviews'
import { ChannelPeekModal, type ChannelPeek } from './ChannelPeekModal'
import { NirpekshMeter } from './NirpekshMeter'

type ReportPageProps = {
  channels: Channel[]
  ratings: Record<string, RatingState>
  onBrowseChannels: () => void
  onViewChannel: (channelId: string) => void
  onWatchChannel: (channelId: string) => void
}

export function ReportPage({
  channels,
  ratings,
  onBrowseChannels,
  onViewChannel,
  onWatchChannel,
}: ReportPageProps) {
  const { t, lang } = useI18n()
  const [reviews, setReviews] = useState<ChannelReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [peek, setPeek] = useState<ChannelPeek | null>(null)

  useEffect(() => {
    let cancelled = false
    setReviewsLoading(true)
    fetchAllChannelReviews(channels.map((channel) => channel.id)).then(
      (list) => {
        if (!cancelled) {
          setReviews(list)
          setReviewsLoading(false)
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [channels])

  const channelNameById = Object.fromEntries(
    channels.map((channel) => [channel.id, channel.name]),
  )

  const reviewCountByChannel = reviews.reduce<Record<string, number>>(
    (acc, review) => {
      acc[review.channelId] = (acc[review.channelId] ?? 0) + 1
      return acc
    },
    {},
  )

  const ranked = [...channels]
    .map((channel) => {
      const rating = ratings[channel.id]
      return {
        channel,
        average: getAverage(
          rating ?? { average: 0, sum: 0, count: 0, userRating: null },
        ),
        count: rating?.count ?? 0,
        notes: reviewCountByChannel[channel.id] ?? 0,
      }
    })
    .sort((a, b) => {
      if (b.average !== a.average) return b.average - a.average
      if (b.count !== a.count) return b.count - a.count
      return a.channel.name.localeCompare(b.channel.name)
    })

  const ratedCount = ranked.filter((row) => row.count > 0).length
  const totalVotes = ranked.reduce((sum, row) => sum + row.count, 0)
  const updatedLabel = new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date())

  return (
    <section className="report-page">
      <div className="report-page__intro">
        <p className="report-page__eyebrow">{t('reportTitle')}</p>
        <h2>{t('meterTitle')}</h2>
        <p>{t('reportLede')}</p>
        <p className="report-page__hint">{t('meterClickHint')}</p>
        <div className="report-page__stats">
          <div>
            <strong>{channels.length}</strong>
            <span>{t('reportChannels')}</span>
          </div>
          <div>
            <strong>{ratedCount}</strong>
            <span>{t('reportRated')}</span>
          </div>
          <div>
            <strong>{totalVotes.toLocaleString()}</strong>
            <span>{t('reportVotes')}</span>
          </div>
          <div>
            <strong>{reviews.length.toLocaleString()}</strong>
            <span>{t('reportNotes')}</span>
          </div>
        </div>
        <p className="report-page__updated">
          {t('reportUpdated')}: {updatedLabel}
        </p>
      </div>

      <ol className="report-board">
        {ranked.map((row, index) => {
          const rank = index + 1
          const score = row.count > 0 ? row.average.toFixed(1) : '—'
          return (
            <li key={row.channel.id}>
              <button
                type="button"
                className={`report-board__row${rank <= 3 && row.count > 0 ? ' is-top' : ''}`}
                aria-label={`${rank}. ${row.channel.name}. ${t('openChannel')}`}
                onClick={() =>
                  setPeek({
                    channel: row.channel,
                    rank,
                    average: row.average,
                    count: row.count,
                  })
                }
              >
                <span className="report-board__rank" aria-hidden="true">
                  {rank}
                </span>
                <div className="report-board__channel">
                  <span className="report-board__name">{row.channel.name}</span>
                  <p>
                    {row.channel.handle} · {row.channel.language} · {row.channel.focus}
                    {row.notes > 0
                      ? ` · ${row.notes} ${
                          row.notes === 1 ? t('reportNote') : t('reportNotesShort')
                        }`
                      : ''}
                  </p>
                </div>
                <NirpekshMeter value={row.average} rated={row.count > 0} size="sm" />
                <div className="report-board__score">
                  <strong>{score}</strong>
                  <span>
                    {row.count === 0
                      ? t('reportNoVotes')
                      : `${row.count.toLocaleString()} ${
                          row.count === 1 ? t('reportVote') : t('reportVotesShort')
                        }`}
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ol>

      <aside className="report-how" aria-label={t('reportHowTitle')}>
        <h3>{t('reportHowTitle')}</h3>
        <p>{t('reportHowBody')}</p>
        <p className="report-how__example">
          {lang === 'hi'
            ? 'उदाहरण: दो लोग 5 और 3 दें → (5 + 3) ÷ 2 = 4.0'
            : 'Example: two people rate 5 and 3 → (5 + 3) ÷ 2 = 4.0'}
        </p>
      </aside>

      <div className="report-notes">
        <h3>{t('reportNotesTitle')}</h3>
        <p className="report-notes__lede">{t('reportNotesLede')}</p>

        {reviewsLoading ? (
          <p className="report-notes__empty">{t('reportNotesLoading')}</p>
        ) : reviews.length === 0 ? (
          <p className="report-notes__empty">{t('reportNotesEmpty')}</p>
        ) : (
          <ul className="report-notes__list">
            {reviews.slice(0, 40).map((review) => (
              <li key={`${review.channelId}-${review.uid}-${review.createdAt}`}>
                <div className="report-notes__meta">
                  <strong>{review.name}</strong>
                  <span>
                    {channelNameById[review.channelId] ?? review.channelId}
                  </span>
                </div>
                <p>{review.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="report-page__cta">
        {t('reportCta')}{' '}
        <button type="button" className="text-btn" onClick={onBrowseChannels}>
          {t('channels')}
        </button>
      </p>

      {peek ? (
        <ChannelPeekModal
          peek={peek}
          onClose={() => setPeek(null)}
          onWatchChannel={(channelId) => {
            setPeek(null)
            onWatchChannel(channelId)
          }}
          onViewChannel={(channelId) => {
            setPeek(null)
            onViewChannel(channelId)
          }}
        />
      ) : null}
    </section>
  )
}
