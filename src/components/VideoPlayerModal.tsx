import { useEffect } from 'react'
import { createPortal } from 'react-dom'

type VideoPlayerModalProps = {
  videoId: string
  title: string
  onClose: () => void
}

export function VideoPlayerModal({ videoId, title, onClose }: VideoPlayerModalProps) {
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
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="video-modal__panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="video-modal__head">
          <h2 className="video-modal__title">{title}</h2>
          <button
            type="button"
            className="video-modal__close"
            onClick={onClose}
            aria-label="Close video"
          >
            ×
          </button>
        </div>
        <div className="video-modal__frame">
          <iframe
            title={title}
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        <a
          className="video-modal__yt"
          href={`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open on YouTube →
        </a>
      </div>
    </div>,
    document.body,
  )
}
