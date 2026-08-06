import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  googleClientId,
  mountGoogleSignInButton,
  signInWithGooglePopup,
} from '../lib/firebase'

export function AuthControls() {
  const { user, loading, configured, signOut } = useAuth()
  const buttonHost = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!configured || loading || user || !googleClientId) return
    const el = buttonHost.current
    if (!el) return

    let cleanup: (() => void) | undefined
    let cancelled = false

    void mountGoogleSignInButton(el, (message) => {
      if (!cancelled) setError(message)
    })
      .then((dispose) => {
        if (cancelled) dispose()
        else cleanup = dispose
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Google button failed')
        }
      })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [configured, loading, user])

  async function handlePopupFallback() {
    setBusy(true)
    setError('')
    try {
      await signInWithGooglePopup()
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String(err.code)
          : ''
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/popup-blocked'
      ) {
        setError(
          'Popup still blocked. Add VITE_GOOGLE_CLIENT_ID (see below) and use the Google button.',
        )
      } else {
        setError(err instanceof Error ? err.message : 'Sign-in failed')
      }
    } finally {
      setBusy(false)
    }
  }

  if (!configured) {
    return (
      <div className="auth-controls">
        <button type="button" className="auth-btn auth-btn--muted" disabled>
          Login setup needed
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="auth-controls">
        <span className="auth-status">Checking login…</span>
      </div>
    )
  }

  if (user) {
    return (
      <div className="auth-controls">
        {user.photoURL ? (
          <img className="auth-avatar" src={user.photoURL} alt="" />
        ) : null}
        <span className="auth-status">{user.displayName ?? user.email}</span>
        <button
          type="button"
          className="auth-btn"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="auth-controls auth-controls--stack">
      {googleClientId ? (
        <div ref={buttonHost} className="auth-google-btn" />
      ) : (
        <>
          <button
            type="button"
            className="auth-btn auth-btn--primary"
            disabled={busy}
            onClick={() => void handlePopupFallback()}
          >
            {busy ? 'Signing in…' : 'Sign in with Google'}
          </button>
          <span className="auth-error">
            Popup keeps failing in Chrome. Add Web client ID to `.env` as
            `VITE_GOOGLE_CLIENT_ID` (Firebase → Authentication → Google → Web
            client ID), then restart `npm run dev`.
          </span>
        </>
      )}
      {error ? <span className="auth-error">{error}</span> : null}
    </div>
  )
}
