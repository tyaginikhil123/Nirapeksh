import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  getIdToken,
  isFirebaseConfigured,
  signInWithGoogle,
  signOutUser,
  subscribeToAuth,
  type User,
} from '../lib/firebase'

type AuthContextValue = {
  user: User | null
  loading: boolean
  configured: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  getToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(isFirebaseConfigured)

  useEffect(() => {
    return subscribeToAuth((next) => {
      setUser(next)
      setLoading(false)
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured: isFirebaseConfigured,
      async signIn() {
        await signInWithGoogle()
      },
      async signOut() {
        await signOutUser()
      },
      getToken: () => getIdToken(),
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
