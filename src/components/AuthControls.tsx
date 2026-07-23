import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

export function AuthControls() {
  const { user, loading, configured, signIn, signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSignIn() {
    setBusy(true)
    setError('')
    try {
      await signIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
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
    <div className="auth-controls">
      <button
        type="button"
        className="auth-btn auth-btn--primary"
        disabled={busy}
        onClick={() => void handleSignIn()}
      >
        {busy ? 'Signing in…' : 'Sign in with Google'}
      </button>
      {error ? <span className="auth-error">{error}</span> : null}
    </div>
  )
}
