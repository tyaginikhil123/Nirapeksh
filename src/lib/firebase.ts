import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const googleClientId = (
  import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
)?.trim()

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
)

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let gisScriptPromise: Promise<void> | null = null

type GisCredentialResponse = { credential: string }

type GisIdApi = {
  initialize: (config: {
    client_id: string
    callback: (response: GisCredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
    use_fedcm_for_prompt?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: Record<string, string | number>,
  ) => void
  prompt: (
    momentListener?: (notification: {
      isNotDisplayed: () => boolean
      isSkippedMoment: () => boolean
      isDismissedMoment: () => boolean
    }) => void,
  ) => void
  cancel: () => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GisIdApi } }
  }
}

function getApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured')
  }
  if (!app) {
    app = initializeApp({
      apiKey: firebaseConfig.apiKey!,
      authDomain: firebaseConfig.authDomain!,
      projectId: firebaseConfig.projectId!,
      appId: firebaseConfig.appId!,
    })
  }
  return app
}

export function getFirebaseAuth(): Auth {
  if (!auth) auth = getAuth(getApp())
  return auth
}

export function getDb(): Firestore {
  if (!db) db = getFirestore(getApp())
  return db
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  if (!isFirebaseConfigured) {
    callback(null)
    return () => undefined
  }
  try {
    return onAuthStateChanged(getFirebaseAuth(), callback)
  } catch (error) {
    console.warn('Auth subscribe failed', error)
    callback(null)
    return () => undefined
  }
}

function googleProvider() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  return provider
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.accounts?.id) return Promise.resolve()
  if (gisScriptPromise) return gisScriptPromise

  gisScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-nirapeksh-gis="1"]',
    )
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Google Identity')),
      )
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.nirapekshGis = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity'))
    document.head.appendChild(script)
  })

  return gisScriptPromise
}

export async function signInWithGoogleIdToken(idToken: string) {
  const credential = GoogleAuthProvider.credential(idToken)
  return signInWithCredential(getFirebaseAuth(), credential)
}

/** Official Google button mount — avoids Firebase popup (Chrome passkey issues). */
export async function mountGoogleSignInButton(
  container: HTMLElement,
  onError: (message: string) => void,
): Promise<() => void> {
  if (!googleClientId) {
    throw new Error('Missing VITE_GOOGLE_CLIENT_ID')
  }

  await loadGoogleIdentityScript()
  const gis = window.google?.accounts?.id
  if (!gis) throw new Error('Google Identity failed to load')

  container.replaceChildren()

  gis.initialize({
    client_id: googleClientId,
    callback: (response) => {
      void signInWithGoogleIdToken(response.credential).catch((err) => {
        onError(err instanceof Error ? err.message : 'Sign-in failed')
      })
    },
    auto_select: false,
    cancel_on_tap_outside: true,
  })

  gis.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    width: 240,
  })

  return () => {
    container.replaceChildren()
  }
}

/** Fallback only — often closed by Chrome passkeys / popup blockers. */
export async function signInWithGooglePopup() {
  return signInWithPopup(getFirebaseAuth(), googleProvider())
}

export async function signInWithGoogle() {
  if (googleClientId) {
    await loadGoogleIdentityScript()
    const gis = window.google?.accounts?.id
    if (!gis) throw new Error('Google Identity failed to load')

    return new Promise<Awaited<ReturnType<typeof signInWithGoogleIdToken>>>(
      (resolve, reject) => {
        gis.initialize({
          client_id: googleClientId,
          callback: (response) => {
            void signInWithGoogleIdToken(response.credential)
              .then(resolve)
              .catch(reject)
          },
          auto_select: false,
        })

        gis.prompt((notification) => {
          if (
            notification.isNotDisplayed() ||
            notification.isSkippedMoment() ||
            notification.isDismissedMoment()
          ) {
            reject(
              new Error(
                'Use the Google button in the header (One Tap was blocked).',
              ),
            )
          }
        })
      },
    )
  }

  return signInWithGooglePopup()
}

export async function signOutUser() {
  if (!isFirebaseConfigured) return
  await signOut(getFirebaseAuth())
}

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const current = getFirebaseAuth().currentUser
  if (!current) return null
  return current.getIdToken(forceRefresh)
}

export function getCurrentUser(): User | null {
  if (!isFirebaseConfigured) return null
  return getFirebaseAuth().currentUser
}

export type { User }
