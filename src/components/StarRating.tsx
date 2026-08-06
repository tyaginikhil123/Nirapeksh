import { useI18n } from '../i18n/I18nContext'

type StarRatingProps = {
  value: number
  userRating: number | null
  onRate: (rating: number) => void
  voteCount: number
  disabled?: boolean
  locked?: boolean
  onUnlock?: () => void
}

export function StarRating({
  value,
  userRating,
  onRate,
  voteCount,
  disabled = false,
  locked = false,
  onUnlock,
}: StarRatingProps) {
  const { t, lang } = useI18n()
  return (
    <div className="star-rating" onClick={(e) => e.stopPropagation()}>
      <p className="star-rating__label">
        {locked
          ? t('signInToRate')
          : lang === 'hi'
            ? 'इस चैनल को रेट करें'
            : 'Rate this channel'}
      </p>
      <div className="star-rating__stars" role="group" aria-label="Rate this channel">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = (userRating ?? value) >= star
          const isUser = userRating != null && userRating >= star
          return (
            <button
              key={star}
              type="button"
              className={`star-rating__star${filled ? ' is-filled' : ''}${isUser ? ' is-user' : ''}`}
              aria-label={locked ? t('signInToRate') : `Rate ${star} out of 5`}
              aria-pressed={userRating === star}
              disabled={disabled}
              onClick={() => {
                if (locked) {
                  onUnlock?.()
                  return
                }
                onRate(star)
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.5l2.9 5.88 6.5.95-4.7 4.58 1.11 6.47L12 17.77l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.95L12 2.5z" />
              </svg>
            </button>
          )
        })}
      </div>
      <div className="star-rating__meta">
        <strong>{voteCount > 0 ? value.toFixed(1) : '—'}</strong>
        <span>
          {locked
            ? t('signInToRate')
            : voteCount === 0
              ? lang === 'hi'
                ? 'अभी कोई रेटिंग नहीं — पहले बनें'
                : 'No verified ratings yet — be the first'
              : `${voteCount.toLocaleString()} ${
                  lang === 'hi' ? 'रेटिंग' : 'verified ratings'
                }${userRating != null ? ` · ${userRating}` : ''}`}
        </span>
      </div>
      {locked && onUnlock ? (
        <button type="button" className="star-rating__login" onClick={onUnlock}>
          {t('signInToRate')}
        </button>
      ) : null}
    </div>
  )
}
