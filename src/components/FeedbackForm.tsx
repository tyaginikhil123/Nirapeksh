import { useState, type FormEvent } from 'react'

const FEEDBACK_EMAIL = 'kumarnikhil474551@gmail.com'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export function FeedbackForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('sending')
    setError('')

    try {
      const res = await fetch(`https://formsubmit.co/ajax/${FEEDBACK_EMAIL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          message,
          _subject: 'Nirapeksh website feedback',
          _template: 'table',
        }),
      })

      if (!res.ok) throw new Error('Could not send feedback')
      setStatus('sent')
      setName('')
      setEmail('')
      setMessage('')
    } catch (err) {
      setStatus('error')
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. You can email directly instead.',
      )
    }
  }

  return (
    <section className="feedback" id="feedback">
      <div className="feedback__intro">
        <h2>Feedback</h2>
        <p>
          Suggest a channel, report a bad listing, or share an idea. Messages go
          to{' '}
          <a href={`mailto:${FEEDBACK_EMAIL}`}>{FEEDBACK_EMAIL}</a>.
        </p>
      </div>

      <form className="feedback__form" onSubmit={(e) => void handleSubmit(e)}>
        <label>
          Name
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </label>
        <label>
          Your email
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
          Message
          <textarea
            name="message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            placeholder="What should Nirapeksh improve or add?"
          />
        </label>
        <div className="feedback__actions">
          <button type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Send feedback'}
          </button>
          {status === 'sent' ? (
            <p className="feedback__ok">Thanks — feedback sent to Nikhil.</p>
          ) : null}
          {status === 'error' ? <p className="feedback__err">{error}</p> : null}
        </div>
      </form>
    </section>
  )
}
