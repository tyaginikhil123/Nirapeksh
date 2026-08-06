import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type User,
  type UserCredential,
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

function authErrorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) return String(err.code)
  return ''
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
      'script[data-nirpeksh-gis="1"]',
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
    script.dataset.nirpekshGis = '1'
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

/** Completes redirect-based Google sign-in after page return. */
export async function completeGoogleRedirectIfPresent() {
  if (!isFirebaseConfigured) return null
  try {
    return await getRedirectResult(getFirebaseAuth())
  } catch (error) {
    console.warn('Google redirect sign-in failed', error)
    return null
  }
}

/** GIS account chooser — avoids Chrome popup / passkey issues. */
async function signInWithGoogleGis(): Promise<UserCredential> {
  if (!googleClientId) throw new Error('gis-unavailable')
  await loadGoogleIdentityScript()
  const gis = window.google?.accounts?.id
  if (!gis) throw new Error('gis-unavailable')

  return new Promise((resolve, reject) => {
    let settled = false
    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      fn()
    }

    try {
      gis.cancel()
    } catch {
      /* ignore */
    }

    gis.initialize({
      client_id: googleClientId,
      callback: (response) => {
        settle(() => {
          void signInWithGoogleIdToken(response.credential)
            .then(resolve)
            .catch(reject)
        })
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      // FedCM is flaky on some localhost / corporate Chrome setups
      use_fedcm_for_prompt: false,
    })

    gis.prompt((notification) => {
      if (settled) return
      if (
        notification.isNotDisplayed() ||
        notification.isSkippedMoment() ||
        notification.isDismissedMoment()
      ) {
        settle(() => reject(new Error('gis-unavailable')))
      }
    })
  })
}

export async function signInWithGooglePopup() {
  return signInWithPopup(getFirebaseAuth(), googleProvider())
}

/**
 * Custom-button sign-in: GIS first (reliable on Mac Chrome),
 * then popup, then full-page redirect if the popup is blocked.
 */
export async function signInWithGoogle(): Promise<UserCredential | null> {
  if (googleClientId) {
    try {
      return await signInWithGoogleGis()
    } catch (error) {
      if (!(error instanceof Error && error.message === 'gis-unavailable')) {
        console.warn('GIS sign-in failed, trying popup', error)
      }
    }
  }

  try {
    return await signInWithGooglePopup()
  } catch (error) {
    const code = authErrorCode(error)
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/internal-error' ||
      code === 'auth/network-request-failed'
    ) {
      await signInWithRedirect(getFirebaseAuth(), googleProvider())
      return null
    }
    throw error
  }
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
