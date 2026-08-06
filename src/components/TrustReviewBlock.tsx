import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import {
  fetchReviews,
  submitReview,
  type TrustReview,
} from '../lib/reviews'

type TrustReviewBlockProps = {
  channelId: string
  canWrite: boolean
  onRequestLogin?: () => void
}

export function TrustReviewBlock({
  channelId,
  canWrite,
  onRequestLogin,
}: TrustReviewBlockProps) {
  const { t } = useI18n()
  const [reviews, setReviews] = useState<TrustReview[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchReviews(channelId).then((list) => {
      if (!cancelled) setReviews(list)
    })
    return () => {
      cancelled = true
    }
  }, [channelId])

  async function handleSave() {
    if (!canWrite) {
      onRequestLogin?.()
      return
    }
    setBusy(true)
    setError('')
    try {
      const next = await submitReview(channelId, draft.trim())
      setReviews(next)
      if (!draft.trim()) setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save review')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="trust-review">
      <p className="trust-review__label">{t('whyTrust')}</p>
      {canWrite ? (
        <>
          <textarea
            className="trust-review__input"
            rows={2}
            maxLength={280}
            placeholder={t('whyTrustPlaceholder')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
          />
          <div className="trust-review__actions">
            <button
              type="button"
              className="trust-review__save"
              disabled={busy}
              onClick={() => void handleSave()}
            >
              {t('saveReview')}
            </button>
            <span className="trust-review__hint">{draft.length}/280</span>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="trust-review__locked"
          onClick={() => onRequestLogin?.()}
        >
          {t('signInToWrite')}
        </button>
      )}
      {error ? <p className="trust-review__error">{error}</p> : null}
      {reviews.length > 0 ? (
        <ul className="trust-review__list" aria-label={t('reviews')}>
          {reviews.slice(0, 3).map((review) => (
            <li key={review.uid + review.createdAt}>
              <strong>{review.name}</strong>
              <span>{review.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
