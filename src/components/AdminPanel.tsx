import { useEffect, useMemo, useState } from 'react'
import type { Channel, Focus, Language } from '../data/channels'
import { FOCUS_OPTIONS } from '../data/channels'
import {
  fetchAllFeedback,
  saveChannelsApi,
  type FeedbackEntry,
} from '../lib/reviews'

type AdminPanelProps = {
  channels: Channel[]
  onSaved: (channels: Channel[]) => void
  onClose: () => void
}

const emptyChannel = (): Channel => ({
  id: `channel-${Date.now()}`,
  name: '',
  handle: '@',
  channelId: '',
  youtubeUrl: 'https://www.youtube.com/@',
  founder: '',
  blurb: '',
  language: 'Hindi',
  focus: 'Ground report',
  subscribersLabel: '',
  tags: [],
  sampleVideos: [],
})

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function AdminPanel({ channels, onSaved, onClose }: AdminPanelProps) {
  const [draft, setDraft] = useState(() => JSON.stringify(channels, null, 2))
  const [selectedId, setSelectedId] = useState(channels[0]?.id ?? '')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'channels' | 'feedback'>('channels')
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([])
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')

  const parsed = useMemo(() => {
    try {
      return JSON.parse(draft) as Channel[]
    } catch {
      return null
    }
  }, [draft])

  const selected = parsed?.find((item) => item.id === selectedId) ?? parsed?.[0]

  useEffect(() => {
    if (tab !== 'feedback') return
    let cancelled = false
    setFeedbackLoading(true)
    setFeedbackError('')
    fetchAllFeedback()
      .then((list) => {
        if (!cancelled) setFeedback(list)
      })
      .catch((err) => {
        if (!cancelled) {
          setFeedbackError(err instanceof Error ? err.message : 'Could not load feedback')
        }
      })
      .finally(() => {
        if (!cancelled) setFeedbackLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab])

  function updateSelected(patch: Partial<Channel>) {
    if (!parsed || !selected) return
    const next = parsed.map((item) =>
      item.id === selected.id ? { ...item, ...patch } : item,
    )
    setDraft(JSON.stringify(next, null, 2))
    setSelectedId(selected.id)
  }

  function addChannel() {
    const nextChannel = emptyChannel()
    const next = [...(parsed ?? channels), nextChannel]
    setDraft(JSON.stringify(next, null, 2))
    setSelectedId(nextChannel.id)
  }

  function removeSelected() {
    if (!parsed || !selected) return
    const next = parsed.filter((item) => item.id !== selected.id)
    setDraft(JSON.stringify(next, null, 2))
    setSelectedId(next[0]?.id ?? '')
  }

  async function handleSave() {
    if (!parsed) {
      setMessage('JSON is invalid')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const result = await saveChannelsApi(parsed)
      onSaved(result.channels as Channel[])
      setMessage('Saved to Firestore (upsert — catalog was not wiped)')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-panel" id="admin">
      <div className="admin-panel__head">
        <h2>Admin panel</h2>
        <button type="button" className="auth-btn" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="admin-panel__lede">
        Private admin area. Channel saves upsert by id (writes first, then removes
        dropped channels). Feedback is read from Firestore.
      </p>

      <div className="admin-panel__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'channels'}
          className={`admin-panel__tab${tab === 'channels' ? ' is-active' : ''}`}
          onClick={() => setTab('channels')}
        >
          Channels
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'feedback'}
          className={`admin-panel__tab${tab === 'feedback' ? ' is-active' : ''}`}
          onClick={() => setTab('feedback')}
        >
          Feedback inbox{feedback.length ? ` (${feedback.length})` : ''}
        </button>
      </div>

      {tab === 'feedback' ? (
        <div className="admin-feedback">
          {feedbackLoading ? <p>Loading feedback…</p> : null}
          {feedbackError ? <p className="banner-note banner-note--error">{feedbackError}</p> : null}
          {!feedbackLoading && !feedbackError && feedback.length === 0 ? (
            <p>No feedback yet.</p>
          ) : null}
          <ul className="admin-feedback__list">
            {feedback.map((entry) => (
              <li key={entry.id} className="admin-feedback__item">
                <div className="admin-feedback__meta">
                  <strong>{entry.name}</strong>
                  <a href={`mailto:${entry.email}`}>{entry.email}</a>
                  <time dateTime={entry.createdAt}>{formatWhen(entry.createdAt)}</time>
                </div>
                <p>{entry.message}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <div className="admin-panel__layout">
            <div className="admin-panel__list">
              <button type="button" className="auth-btn auth-btn--primary" onClick={addChannel}>
                Add channel
              </button>
              <ul>
                {(parsed ?? []).map((channel) => (
                  <li key={channel.id}>
                    <button
                      type="button"
                      className={channel.id === selected?.id ? 'is-active' : ''}
                      onClick={() => setSelectedId(channel.id)}
                    >
                      {channel.name || channel.id}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {selected ? (
              <div className="admin-panel__form">
                <label>
                  Name
                  <input
                    value={selected.name}
                    onChange={(e) => updateSelected({ name: e.target.value })}
                  />
                </label>
                <label>
                  Handle
                  <input
                    value={selected.handle}
                    onChange={(e) => updateSelected({ handle: e.target.value })}
                  />
                </label>
                <label>
                  Channel ID
                  <input
                    value={selected.channelId}
                    onChange={(e) => updateSelected({ channelId: e.target.value })}
                  />
                </label>
                <label>
                  YouTube URL
                  <input
                    value={selected.youtubeUrl}
                    onChange={(e) => updateSelected({ youtubeUrl: e.target.value })}
                  />
                </label>
                <label>
                  Founder
                  <input
                    value={selected.founder}
                    onChange={(e) => updateSelected({ founder: e.target.value })}
                  />
                </label>
                <label>
                  Subscribers label
                  <input
                    value={selected.subscribersLabel}
                    onChange={(e) =>
                      updateSelected({ subscribersLabel: e.target.value })
                    }
                  />
                </label>
                <label>
                  Language
                  <select
                    value={selected.language}
                    onChange={(e) =>
                      updateSelected({ language: e.target.value as Language })
                    }
                  >
                    <option value="Hindi">Hindi</option>
                    <option value="English">English</option>
                    <option value="Both">Both</option>
                  </select>
                </label>
                <label>
                  Focus
                  <select
                    value={selected.focus}
                    onChange={(e) =>
                      updateSelected({ focus: e.target.value as Focus })
                    }
                  >
                    {FOCUS_OPTIONS.map((focus) => (
                      <option key={focus} value={focus}>
                        {focus}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-panel__wide">
                  Tags (comma separated)
                  <input
                    value={selected.tags.join(', ')}
                    onChange={(e) =>
                      updateSelected({
                        tags: e.target.value
                          .split(',')
                          .map((tag) => tag.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
                <label className="admin-panel__wide">
                  Blurb
                  <textarea
                    rows={3}
                    value={selected.blurb}
                    onChange={(e) => updateSelected({ blurb: e.target.value })}
                  />
                </label>
                <button type="button" className="auth-btn" onClick={removeSelected}>
                  Delete channel
                </button>
              </div>
            ) : null}
          </div>

          <label className="admin-panel__json">
            Raw JSON
            <textarea
              rows={10}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
            />
          </label>

          <div className="admin-panel__actions">
            <button
              type="button"
              className="auth-btn auth-btn--primary"
              disabled={busy}
              onClick={() => void handleSave()}
            >
              {busy ? 'Saving…' : 'Save channels'}
            </button>
            {message ? <span>{message}</span> : null}
          </div>
        </>
      )}
    </section>
  )
}
