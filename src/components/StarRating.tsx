import { useI18n } from '../i18n/I18nContext'

function GoogleMark() {
  return (
    <svg
      className="google-signin__mark"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

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

  const metaText =
    voteCount === 0
      ? lang === 'hi'
        ? 'अभी कोई रेटिंग नहीं'
        : 'No ratings yet'
      : `${voteCount.toLocaleString()} ${
          lang === 'hi' ? 'रेटिंग' : voteCount === 1 ? 'rating' : 'ratings'
        }${
          userRating != null
            ? lang === 'hi'
              ? ` · आपकी ${userRating}`
              : ` · yours ${userRating}`
            : ''
        }`

  return (
    <div className={`star-rating${locked ? ' is-locked' : ''}`}>
      <p className="star-rating__label">{t('rateThisChannel')}</p>
      <div
        className="star-rating__stars"
        role="group"
        aria-label={t('rateThisChannel')}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = (userRating ?? value) >= star
          const isUser = userRating != null && userRating >= star
          return (
            <button
              key={star}
              type="button"
              className={`star-rating__star${filled ? ' is-filled' : ''}${isUser ? ' is-user' : ''}`}
              aria-label={
                locked
                  ? t('signInWithGoogle')
                  : `Rate ${star} out of 5`
              }
              aria-pressed={userRating === star}
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation()
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
        <span>{metaText}</span>
      </div>
      {locked && onUnlock ? (
        <button
          type="button"
          className="google-signin google-signin--compact"
          onClick={(e) => {
            e.stopPropagation()
            onUnlock()
          }}
        >
          <GoogleMark />
          <span>{t('signInWithGoogle')}</span>
        </button>
      ) : null}
    </div>
  )
}
