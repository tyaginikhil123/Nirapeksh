import { useState, type FormEvent } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { submitFeedback } from '../lib/reviews'

const FEEDBACK_EMAIL = 'kumarnikhil474551@gmail.com'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export function FeedbackForm() {
  const { t, lang } = useI18n()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [okNote, setOkNote] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('sending')
    setError('')
    setOkNote('')

    try {
      await submitFeedback({ name, email, message })
      setStatus('sent')
      setName('')
      setEmail('')
      setMessage('')
      setOkNote(
        lang === 'hi'
          ? 'धन्यवाद — फीडबैक Firestore में सेव हो गया।'
          : 'Thanks — feedback saved to Firestore.',
      )
    } catch (err) {
      setStatus('error')
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. You can email directly instead.',
      )
    }
  }

  function openMailFallback() {
    const subject = encodeURIComponent('Nirpeksh website feedback')
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\n${message}`,
    )
    window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`
  }

  return (
    <section className="feedback" id="feedback">
      <div className="feedback__intro">
        <h2>{t('feedbackTitle')}</h2>
        <p>
          {lang === 'hi'
            ? 'चैनल सुझाव, गलती की जानकारी या आइडिया भेजें। मेल:'
            : 'Suggest a channel, report a bad listing, or share an idea. Contact:'}{' '}
          <a href={`mailto:${FEEDBACK_EMAIL}`}>{FEEDBACK_EMAIL}</a>.
        </p>
      </div>

      <form className="feedback__form" onSubmit={(e) => void handleSubmit(e)}>
        <label>
          {lang === 'hi' ? 'नाम' : 'Name'}
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </label>
        <label>
          {lang === 'hi' ? 'आपका ईमेल' : 'Your email'}
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="feedback__message">
          {lang === 'hi' ? 'संदेश' : 'Message'}
          <textarea
            name="message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            placeholder={
              lang === 'hi'
                ? 'Nirpeksh में क्या जोड़ना/सुधारना चाहिए?'
                : 'What should Nirpeksh improve or add?'
            }
          />
        </label>
        <div className="feedback__actions">
          <button type="submit" disabled={status === 'sending'}>
            {status === 'sending'
              ? lang === 'hi'
                ? 'भेजा जा रहा है…'
                : 'Sending…'
              : lang === 'hi'
                ? 'फीडबैक भेजें'
                : 'Send feedback'}
          </button>
          <button
            type="button"
            className="feedback__mailto"
            onClick={openMailFallback}
          >
            {lang === 'hi' ? 'ईमेल ऐप से भेजें' : 'Open in email app'}
          </button>
          {status === 'sent' && okNote ? (
            <p className="feedback__ok">{okNote}</p>
          ) : null}
          {status === 'error' ? <p className="feedback__err">{error}</p> : null}
        </div>
      </form>
    </section>
  )
}
